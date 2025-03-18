import { InputSpeed } from "../../shared/models/input-speed";
import { BotManager } from "./bot-manager";
import { RankedBotUser } from "./ranked-bot-user";

interface BotType {
    trophies: number,
    speed: InputSpeed,
    inaccuracy: number,
    misdrop: number,
    botIDs: string[],
}

// const bots: BotType[] = [
//     {
//         trophies: 400,
//         speed: InputSpeed.HZ_6,
//         misdrop: 0.15,
//         botIDs: [
//             "6877a435-956a-46e5-a819-ed7c8dc5691c",
//             "1eed0577-a297-445e-9997-feb2b8441e9b",
//             "2f7d2c9b-4568-4ad2-944e-fa0341e3046c",
//         ]
//     },
//     {
//         trophies: 400,
//         speed: InputSpeed.HZ_6,
//         misdrop: 0.1,
//         botIDs: [
//             "6f37a1e1-16c2-4407-93e9-a418a569dbb8",
//             "c6ef00e2-adca-430a-95df-70e37c319257",
//             "a29b6c72-7b8f-4ebc-8e4b-6bb256fb38d0",
//         ]
//     },
//     {
//         trophies: 400,
//         speed: InputSpeed.HZ_8,
//         misdrop: 0.15,
//         botIDs: [
//             "8332adf7-665b-4704-8177-13d01b50782a",
//             "ca6ee68b-3357-46df-ad8f-921e0f1033b8",
//             "d739720a-cc5d-4794-af99-3d091a828fe9",
//         ]
//     },
//     {
//         trophies: 400,
//         speed: InputSpeed.HZ_10,
//         misdrop: 0.2,
//         botIDs: [
//             "a3f14e82-5191-4744-80f8-1739ead9df0c",
//             "bd45cd9f-4d57-4ff5-bb18-654f25fd5bc9",
//             "6daf6783-d326-4753-87ab-6cdf5d19c2a8",
//         ]
//     },

//     {
//         trophies: 1200,
//         speed: InputSpeed.HZ_8,
//         misdrop: 0.05,
//         botIDs: [
//             "3dc01b06-7549-454c-87b4-2c6853a32559",
//             "d9a4f0b3-e14d-4469-a79c-dc325119b671",
//             "e8f50046-ebee-4aef-9388-1ba52fd8ebf4",
//         ]
//     },
//     {
//         trophies: 1200,
//         speed: InputSpeed.HZ_10,
//         misdrop: 0.03,
//         botIDs: [
//             "bc5939d5-9524-4115-ad63-d8cb18d2dd0e",
//             "3fdb8578-c9e4-4165-8226-c8910671f2b8",
//             "46c75a47-cd74-47fd-8f01-03fc8ca6490b",
//         ]
//     },
//     {
//         trophies: 1200,
//         speed: InputSpeed.HZ_12,
//         misdrop: 0.1,
//         botIDs: [
//             "392792e5-3e26-492b-b69a-4d9316c5ff8d",
//             "c11aa9f6-35b3-45ac-af9c-f19b2eff37d7",
//             "f3b0e349-dc06-41f4-ae65-e8921dbf7676",
//         ]
//     },
//     {
//         trophies: 1200,
//         speed: InputSpeed.HZ_15,
//         misdrop: 0.15,
//         botIDs: [
//             "0b4b6a40-a082-43db-9c14-c764c3ff5aa6",
//             "5791277d-e0ca-4823-95b4-1b43ef91eb43",
//             "e3b3e8cd-2a58-41a7-ab7c-8c864f7a55a1",
//         ]
//     },

//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_15,
//         misdrop: 0.05,
//         botIDs: [
//             "35552657-8688-44df-b2c8-13b1ea0c5aa6",
//             "39c1d1cf-5d30-425e-abdd-cebb1ab84c27",
//             "b7936619-1891-446c-93f5-bdd2c9d7db3a",
//         ]
//     },
//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_10,
//         misdrop: 0.02,
//         botIDs: [
//             "d193c6b0-747c-48b9-8529-c600e6eeb280",
//             "becdb83f-b7c9-47bb-a7b2-0ddb764a4ec9",
//             "40a118b0-aea8-4dfa-a40e-a840e4947483",
//         ]
//     },
//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_12,
//         misdrop: 0.01,
//         botIDs: [
//             "e92daaf3-6faf-4ab3-aa2f-e65e2d03a5a4",
//             "006ede55-fe73-4cb4-9659-ac1ab2a35d7d",
//             "30172e77-1c7b-464e-bb21-cad95def54a7",
//         ]
//     },
//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_15,
//         misdrop: 0.005,
//         botIDs: [
//             "7d4cbe1a-4d40-4304-9248-4b117f5a41b7",
//             "dd03afaa-8959-4b53-9554-12f2478ccebb",
//             "9740ae78-3b13-4011-8706-8ec6adc9cbf0",
//         ]
//     },
//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_20,
//         misdrop: 0.003,
//         botIDs: [
//             "3dbc1e2f-5210-4f40-86de-bed3c9562ac1",
//             "27c515a0-e4ef-44e2-b776-45a3f08645d1",
//             "56c62532-65d6-477a-8f59-643672503aeb",
//         ]
//     },
//     {
//         trophies: 2000,
//         speed: InputSpeed.HZ_25,
//         misdrop: 0.001,
//         botIDs: [
//             "a98fbce4-ada9-4095-888c-b4b362bd4d9a",
//             "88314584-5db8-450e-8182-5c24d929eb5d",
//             "76bed2a9-7e84-477e-ae19-7e651e25bd06",
//         ]
//     },
// ]
const bots: BotType[] = [];

export function registerSRBots(manager: BotManager) {

    for (let { trophies, speed, inaccuracy, misdrop, botIDs } of bots) {
        botIDs.forEach((userid) => manager.registerBot(new RankedBotUser(
            userid,
            trophies,
            {aiConfig : { inputSpeed: speed, inaccuracy, misdrop }}
        )));
    }

}