import { RELEASE_HASH, Version } from "../../../shared/version";
import { GetRoute, UserInfo } from "../route";

/**
 * Get the hash of this version
 */
export class GetVersionRoute extends GetRoute<Version> {
    route = "/api/v2/version";

    override async get(userInfo: UserInfo | undefined) {
        return { hash: RELEASE_HASH };
    }
}