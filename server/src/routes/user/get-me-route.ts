import { Authentication, DBUser } from "../../../shared/models/db-user";
import { RELEASE_HASH } from "../../../shared/version";
import { DBObjectNotFoundError } from "../../database/db-object-error";
import { DBUserObject } from "../../database/db-objects/db-user";
import { GetRoute, Redirect, RouteError, UserInfo } from "../route";

/**
 * Route for getting the logged in user's information
 */
export class GetMeRoute extends GetRoute<DBUser> {
    route = "/api/v2/me";

    override async get(userInfo: UserInfo | undefined, pathParams: any, queryParams: any): Promise<DBUser | Redirect> {

        const clientHash = queryParams.v as string;
        if (clientHash !== RELEASE_HASH) {
            console.log(`Account ${userInfo?.username} is on old version of client; forcing redirect...`);
            const randomQuery = Math.random().toString(36).substring(7); // Random string
            return new Redirect(`/?v=${randomQuery}`);
        }

        // Normally this should be an authenticated route. But because we want to check for client hash regardless of 
        // authentication, we authenticate manually after checking
        if (!userInfo || userInfo.authentication ===  Authentication.NONE) {
            throw new RouteError(401, "You are not logged in!");
        }
        
        try {
            // get the user object from either the in-memory cache or the database
            return await DBUserObject.get(userInfo!.userid);

        } catch (error: any) {
            // if the user is not found, return a 404 error
            if (error instanceof DBObjectNotFoundError) {
                throw new RouteError(404, "User not found");
            } else {
                throw new RouteError(500, `Unexpected error: ${error.message}`);
            }
        }
    }
}