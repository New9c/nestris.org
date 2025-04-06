import { ClientRoom } from "./client-room";
import { InRoomStatus, InRoomStatusMessage } from "src/app/shared/network/json-message";
import { AnalyticsService } from "../analytics.service";
import { PuzzleRushRoomState } from "src/app/shared/room/puzzle-rush-models";
import { MeService } from "../state/me.service";


export class PuzzleRushClientRoom extends ClientRoom {

    readonly analytics = this.injector.get(AnalyticsService);
    readonly me = this.injector.get(MeService);

    private myIndex!: number;

    public override async init(event: InRoomStatusMessage): Promise<void> {
        const state = event.roomState as PuzzleRushRoomState;

        this.myIndex = state.players.map(player => player.userid).indexOf(await this.me.getUserID());
        if (this.myIndex === -1) throw new Error("User is not either of the players in the room");

        this.analytics.sendEvent("puzzle-rush");
    }

    public getMyIndex(): number {
        return this.myIndex;
    }

    protected override async onStateUpdate(oldState: PuzzleRushRoomState, newState: PuzzleRushRoomState): Promise<void> {
        
    }

    public override destroy(): void {

    }
}