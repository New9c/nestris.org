import { DBQuery } from "../db-query";

/**
 * Performance: the median of your scores in your last 50 ranked matches,
 *      excluding games where you win and score less than your median
 * Aggression: average Tetris rate over last 50 ranked games , weighted by lines cleared
 * Consistency: a weighted average of consistency score of last 50 ranked games,
 *      where a) for losses, score is (lines reached / lines needed to reach kill screen)
 *      capped at 1, with average weight 1, and b) for wins the score is 1,
 *      with average weight (lines reached / lines needed to reach kill screen )
 */
export class RankedStatsQuery extends DBQuery<{
    performance: number, // score
    aggression: number, // percent as a number from 0-100
    consistency: number, // percent as a number from 0-100
}> {
    
    public override query = `
        WITH recent_games AS (
            -- Select the last 50 type = 1 games with additional game info from games table
            SELECT 
                (a.data->>'myScore')::numeric AS my_score,
                (a.data->>'opponentScore')::numeric AS opponent_score,
                a.data->>'myGameID' AS game_id,
                g.tetris_rate,
                g.end_lines,
                g.start_level,
                CASE 
                    WHEN g.start_level IN (6, 9) THEN 290
                    WHEN g.start_level = 12 THEN 260
                    WHEN g.start_level IN (15, 18) THEN 230
                    ELSE NULL
                END AS lines_to_kill_screen
            FROM activities a
            LEFT JOIN games g ON g.id = a.data->>'myGameID'
            WHERE a.userid = $1
            AND a.data->>'type' = '1'
            AND g.tetris_rate IS NOT NULL
            AND g.start_level IN (6, 9, 12, 15, 18)
            ORDER BY a.created_at DESC
            LIMIT 50
        ),
        consistency_calculation AS (
            SELECT 
                my_score,
                opponent_score,
                tetris_rate,
                end_lines,
                lines_to_kill_screen,
                CASE 
                    WHEN my_score < opponent_score THEN 
                        -- For losses: (lines reached / lines to kill screen), capped at 1
                        LEAST(end_lines * 1.0 / lines_to_kill_screen, 1.0)
                    ELSE 
                        -- For wins: 1 with weight of (lines reached / lines to kill screen)
                        1.0
                END AS consistency_score,
                CASE 
                    WHEN my_score < opponent_score THEN 1.0 -- Average weight 1 for losses
                    ELSE end_lines * 1.0 / lines_to_kill_screen -- Weight based on progress for wins
                END AS consistency_weight
            FROM recent_games
        ),
        median_m AS (
            -- Compute M: the median score from the last 50 games
            SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY my_score) AS M
            FROM recent_games
        ),
        filtered_games AS (
            -- Filter out games where user won but scored less than M
            SELECT 
                my_score, 
                tetris_rate, 
                end_lines,
                consistency_score,
                consistency_weight
            FROM consistency_calculation, median_m
            WHERE my_score < opponent_score -- Lost games (always included)
            OR my_score >= M              -- Won games with at least M points
        ),
        performance_metrics AS (
            -- Calculate weighted average Tetris rate and consistency
            SELECT 
                (SELECT M FROM median_m) AS original_median,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY my_score) AS final_median,
                SUM(tetris_rate * end_lines) * 1.0 / NULLIF(SUM(end_lines), 0) AS weighted_avg_tetris_rate,
                SUM(consistency_score * consistency_weight) / NULLIF(SUM(consistency_weight), 0) AS weighted_consistency
            FROM filtered_games
        )
        SELECT 
            final_median AS performance, 
            ROUND(weighted_avg_tetris_rate, 1) AS aggression,
            ROUND(weighted_consistency * 100, 1) AS consistency
        FROM performance_metrics;
    `;
    public override warningMs = null;

    constructor(userid: string) {
        super([userid])
    };
    
    public override parseResult(resultRows: any[]) {
        const stats = resultRows[0];
        return {
            performance: parseInt(stats.performance ?? 0),
            aggression: parseFloat(stats.aggression ?? 0),
            consistency: parseFloat(stats.consistency ?? 0),
        }
    }
}