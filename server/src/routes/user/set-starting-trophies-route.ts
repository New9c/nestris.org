import { Authentication } from "../../../shared/models/db-user";
import { START_TROPHIES_OPTIONS } from "../../../shared/nestris-org/elo-system";
import { DBSetInitialTrophiesEvent, DBUserObject } from "../../database/db-objects/db-user";
import { EventConsumerManager } from "../../online-users/event-consumer";
import { QuestConsumer } from "../../online-users/event-consumers/quest-consumer";
import { PostRoute, RouteError, UserInfo } from "../route";

/**
 * Route for joining the ranked queue
 */
export class SetStartingTrophiesRoute extends PostRoute {
    route = "/api/v2/set-starting-trophies/:trophies";
    authentication = Authentication.USER;

    override async post(userInfo: UserInfo | undefined, pathParams: any) {
        
        // Make sure trophies is a number
        const trophies = parseInt(pathParams.trophies);
        if (isNaN(trophies)) {
            throw new RouteError(400, `Trophies must be a number`);
        }

        // Make sure starting trophies have not already been set
        const dbUser = await DBUserObject.get(userInfo!.userid);
        if (dbUser.trophies !== -1) {
            throw new RouteError(400, `You have already picked a starting trophy count`);
        }

        // Make sure user is allowed to set starting trophies to this value
        const option = START_TROPHIES_OPTIONS.find(option => option.trophies === trophies);
        if (!option) {
            throw new RouteError(400, `Invalid starting trophy count`);
        }
        if (dbUser.highest_score < option.unlockScore) {
            throw new RouteError(400, `You must score at least ${option.unlockScore} points in a game to set your starting trophy count to ${trophies}`);
        }

        // Set the starting trophies
        const alteredUser = await DBUserObject.alter(userInfo!.userid, new DBSetInitialTrophiesEvent({trophies}), false);
        console.log(`User ${userInfo!.username} set starting trophies to ${trophies}`);

        // Update any trophy quests
        const questConsumer = EventConsumerManager.getInstance().getConsumer(QuestConsumer);
        await questConsumer.updateChampionQuestCategory(userInfo!.userid, alteredUser.wins, alteredUser.highest_trophies);

        return {success: true};
    }
}