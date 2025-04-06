import { DBPuzzle } from "../../../shared/puzzles/db-puzzle";
import { PuzzleRating } from "../../../shared/puzzles/puzzle-rating";
import { Database } from "../../database/db-query";
import { EventConsumer } from "../event-consumer";
import { SamplePuzzlesQuery } from "./rated-puzzle-consumer";

/**
 * The puzzle rush consumer handlers the generation and caching of puzzle rush sets for use in puzzle rush and puzzle battles. A set
 * consists of 200 puzzles (as it is extremely unlikely a player solves more than 200 in 3 minutes), with the following rating breakdown:
 * - 20 puzzles for each 1-4 star rating categories
 * - 120 5 star puzzles
 */


/**
 * Rearranges the array to be mostly sorted by rating, with some local noise.
 * @param arr The input array of RatedObjects.
 */
interface RatedObject {
    rating: PuzzleRating;
}
function smartMostlySorted(puzzles: RatedObject[]): RatedObject[] {
    const total = puzzles.length;

    const NOISE = 3;
  
    // Group puzzles by rating
    const ratingBuckets: Map<PuzzleRating, RatedObject[]> = new Map();
    for (const puzzle of puzzles) {
      const list = ratingBuckets.get(puzzle.rating) || [];
      list.push(puzzle);
      ratingBuckets.set(puzzle.rating, list);
    }
  
    const result: RatedObject[] = [];
  
    for (let i = 0; i < total; i++) {
      const progress = i / total;
      const expectedRating = 1 + 4 * progress;
      const noisyRating = Math.round(expectedRating + (Math.random() - 0.5) * NOISE);
      const clampedRating = Math.max(1, Math.min(5, noisyRating)) as PuzzleRating;
  
      // Try from clampedRating outward (1 to 5)
      let found = false;
      for (let delta = 0; delta <= 4; delta++) {
        for (const offset of [-delta, delta]) {
          const tryRating = clampedRating + offset as PuzzleRating;
          if (tryRating < 1 || tryRating > 5) continue;
          const bucket = ratingBuckets.get(tryRating);
          if (bucket && bucket.length > 0) {
            result.push(bucket.pop()!);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
  
    return result;
}


/**
 * Generates a set  puzzles of rating 1-5
 * @param totalCount the total number of puzzles to generates
 * @param categoryCount the number of puzzles to generate for each rating 1-4, where remaining goes to 5
 */
async function generatePuzzleRushSet(totalCount: number = 200, categoryCount: number = 20): Promise<DBPuzzle[]> {

    const puzzleCountForRating = (rating: PuzzleRating) => rating === PuzzleRating.FIVE_STAR ? (totalCount - categoryCount*4) : categoryCount;
    if (puzzleCountForRating(PuzzleRating.FIVE_STAR) <= 0) throw new Error("Not enough total count for 5 star puzzles");

    // Fetch puzzles for ratings 1-4 and 5 in parallel
    const puzzlePromises = [];

    // Loop to create promises for ratings 1-4
    for (let rating = PuzzleRating.ONE_STAR; rating <= PuzzleRating.FOUR_STAR; rating++) {
        puzzlePromises.push(Database.query(SamplePuzzlesQuery, rating, puzzleCountForRating(rating)));
    }

    // Fetch the remaining puzzles for rating 5
    puzzlePromises.push(Database.query(SamplePuzzlesQuery, PuzzleRating.FIVE_STAR, puzzleCountForRating(PuzzleRating.FIVE_STAR)));

    // Wait for all promises to resolve, fetching all puzzles in parallel
    const puzzleSets = await Promise.all(puzzlePromises);

    // Combine all the fetched puzzles into a single array
    const puzzles: DBPuzzle[] = puzzleSets.flat();

    // Return the full set of puzzles, sorted with some noise
    return smartMostlySorted(puzzles) as DBPuzzle[];
}


class PuzzleRushSet {

    // Set of userids that were given this set
    private userids = new Set<string>();

    constructor(
        public readonly set: DBPuzzle[] // Ordered set of puzzle rush puzzles
    ) {}

    // When a puzzle rush set is given a user, add to the set
    markAsUsed(userid: string) {
        this.userids.add(userid);
    }

    // Check whether puzzle set has already been given to this user
    usedBy(userid: string) {
        return this.userids.has(userid);
    }

    // The number of users who have used this set
    useCount() {
        return this.userids.size;
    }

    getUserIds(): string[] {
        return Array.from(this.userids);
    }
    
}

export class PuzzleRushConsumer extends EventConsumer {

    // A constantly updating cache of puzzle rush sets to be fed into puzzle rush and puzzle battle games
    private readonly sets: PuzzleRushSet[] = [];

    // The number of puzzle sets to keep in cache
    private readonly CACHE_SIZE = 20;

    // The number of sets a player can go through before the most used set needs to be replaced
    private readonly MAX_CACHE_USAGE_BY_PLAYER = 10;


    public override async init(): Promise<void> {

        // Generate initial puzzle rush set cache
        const startTime = Date.now();
        for (let i = 0; i < this.CACHE_SIZE; i++) {
            this.sets.push(new PuzzleRushSet(await generatePuzzleRushSet()));
        }
        console.log(`Initialized ${this.sets.length} puzzle rush sets in ${Date.now() - startTime} ms`);
    }

    // Whether the user has used more of the sets in the current cache than allowed
    private userExceedsMaxCacheUsage(userid: string) {
        return this.sets.filter(set => set.usedBy(userid)).length > this.MAX_CACHE_USAGE_BY_PLAYER;
    }

    /**
     * Fetch a generated puzzle rush set for the users, where it is guaranteed the users have not seen the puzzles before.
     * If there exists a set in the cache, return it and mark them as visited by the users.
     * If no puzzle set exists in the cache that has not been used by any of the users, return a new puzzle set
     */
    public async fetchPuzzleSetForUsers(userids: string[]): Promise<DBPuzzle[]> {

        // The sets that haven't been used by any of the userids
        const unusedPuzzleSets = this.sets.filter(set => userids.every(userid => !set.usedBy(userid)));

        // If all the sets have been used, find a new set. Do not replenish here, as it should have already been replenishing by existing logic
        if (unusedPuzzleSets.length === 0) {
            console.log("All puzzle sets used, generating new set");
            return await generatePuzzleRushSet();
        }

        // Select the set that has been most used. This minimizes the need to replenish, as coalescing usage into a single set frees up a new
        // space for a new unused set for all those sets that were recently used
        let selectedPuzzleSet = unusedPuzzleSets[0];
        for (let currentSet of unusedPuzzleSets) {
            if (currentSet.useCount() > selectedPuzzleSet.useCount()) selectedPuzzleSet = currentSet;
        }

        // Mark the current set as used by each of the users
        userids.forEach(userid => selectedPuzzleSet.markAsUsed(userid));

        // Check if any of the requesting users now exceed max cache usage, forcing a replenish
        if (userids.some(userid => this.userExceedsMaxCacheUsage(userid))) {
            console.log("exceed max cache usage, replacing set")

            // Remove the most used set from the cache
            this.sets.splice(this.sets.indexOf(selectedPuzzleSet), 1);

            // Start adding a new set to the cache, but do not wait for completion
            generatePuzzleRushSet().then((newSet) => this.sets.push(new PuzzleRushSet(newSet)));
        }

        // Return the puzzle rush set
        console.log("fetch from cache with set used by", selectedPuzzleSet.getUserIds());
        return selectedPuzzleSet.set;
    }

}

function testMostlyStarted() {

    // Helper to create a list of RatedObjects with the given rating
    function createRatedObjects(count: number, rating: PuzzleRating): RatedObject[] {
        return Array.from({ length: count }, () => ({ rating }));
    }
    
    // Build the input array
    const testArray: RatedObject[] = [
        ...createRatedObjects(20, PuzzleRating.ONE_STAR),
        ...createRatedObjects(20, PuzzleRating.TWO_STAR),
        ...createRatedObjects(20, PuzzleRating.THREE_STAR),
        ...createRatedObjects(20, PuzzleRating.FOUR_STAR),
        ...createRatedObjects(120, PuzzleRating.FIVE_STAR),
    ];
    
    // Shuffle input so it's not already sorted
    function shuffle<T>(array: T[]): T[] {
        return [...array].sort(() => Math.random() - 0.5);
    }

    const shuffled = shuffle(testArray);
    console.log("length", shuffled.length);

    // Apply mostly-sort
    const result = smartMostlySorted(shuffled);
    console.log("result length", result.length);

    // Display for inspection
    console.log(result.map(obj => obj.rating).join(", "));

    // Simple check: count how many adjacent pairs are out of order
    let disorderCount = 0;
    for (let i = 0; i < result.length - 1; i++) {
        if (result[i].rating > result[i + 1].rating) {
            disorderCount++;
        }
    }
    console.log(`Disordered pairs: ${disorderCount} / ${result.length - 1}`);
}

