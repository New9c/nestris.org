import { InputSpeed } from "../../shared/models/input-speed";
import { BotManager } from "./bot-manager";
import { RankedBotUser } from "./ranked-bot-user";

interface BotType {
    trophies: number,
    speed: InputSpeed,
    botIDs: string[],
}

const bots: BotType[] = [
    {
        trophies: 400,
        speed: InputSpeed.HZ_5,
        botIDs: [
            "6877a435-956a-46e5-a819-ed7c8dc5691c",
            "1eed0577-a297-445e-9997-feb2b8441e9b",
            "b93f44df-964f-49ca-98b1-2ca843b06fb3",
        ]
    },
    {
        trophies: 400,
        speed: InputSpeed.HZ_6,
        botIDs: [
            "6f37a1e1-16c2-4407-93e9-a418a569dbb8",
            "c6ef00e2-adca-430a-95df-70e37c319257",
            "6d7b240e-bbf9-4f54-ab50-52385b85930b",
        ]
    },
    {
        trophies: 1200,
        speed: InputSpeed.HZ_8,
        botIDs: [
            "3dc01b06-7549-454c-87b4-2c6853a32559",
            "d9a4f0b3-e14d-4469-a79c-dc325119b671",
            "11f29a79-0150-4972-870e-ddbb3509cced",
        ]
    },
    {
        trophies: 1200,
        speed: InputSpeed.HZ_10,
        botIDs: [
            "bc5939d5-9524-4115-ad63-d8cb18d2dd0e",
            "3fdb8578-c9e4-4165-8226-c8910671f2b8",
            "a444c80d-0b8c-4d8b-9f6c-f744f128e6ab",
        ]
    },
    {
        trophies: 2000,
        speed: InputSpeed.HZ_10,
        botIDs: [
            "d193c6b0-747c-48b9-8529-c600e6eeb280",
            "becdb83f-b7c9-47bb-a7b2-0ddb764a4ec9",
            "6df3434f-4f64-4c75-bf5f-d1865204b386",
        ]
    },
    {
        trophies: 2000,
        speed: InputSpeed.HZ_12,
        botIDs: [
            "e92daaf3-6faf-4ab3-aa2f-e65e2d03a5a4",
            "006ede55-fe73-4cb4-9659-ac1ab2a35d7d",
            "814a6564-26ee-4a79-9be3-aa6ff649e682",
        ]
    },
    {
        trophies: 2000,
        speed: InputSpeed.HZ_15,
        botIDs: [
            "7d4cbe1a-4d40-4304-9248-4b117f5a41b7",
            "dd03afaa-8959-4b53-9554-12f2478ccebb",
            "eaecb4a6-ea3c-4b67-a1ac-ff847917ffa2",
        ]
    },
]

export function registerSRBots(manager: BotManager) {

    for (let { trophies, speed, botIDs } of bots) {
        botIDs.forEach((userid) => manager.registerBot(new RankedBotUser(
            userid,
            trophies,
            {aiConfig : { inputSpeed: speed }}
        )));
    }

}