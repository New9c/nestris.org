import express from 'express';
import { Request, Response } from 'express';
import session from 'express-session';
import { createServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';

import { DeploymentEnvironment, ServerStats } from './shared/models/server-stats';
import { handleDiscordCallback, redirectToDiscord } from './src/authentication/discord-util';
import { OnlineUserManager } from './src/online-users/online-user-manager';
import { EventConsumerManager } from './src/online-users/event-consumer';
import { RouteManager } from './src/routes/route';
import { GetMeRoute } from './src/routes/user/get-me-route';
import { GetOnlineUsersRoute } from './src/routes/user/get-online-users-route';
import { FriendEventConsumer } from './src/online-users/event-consumers/friend-event-consumer';
import { GetFriendsInfoRoute } from './src/routes/user/get-friends-info-route';
import { PingConsumer } from './src/online-users/event-consumers/ping-consumer';
import { GetAllUsernamesRoute } from './src/routes/user/get-all-usernames-route';
import { GuestConsumer } from './src/online-users/event-consumers/guest-consumer';
import { LeaderboardManager } from './src/leaderboards/leaderboard-manager';
import { FullHighscoreLeaderboard, FullPuzzlesLeaderboard, FullTrophiesLeaderboard } from './src/leaderboards/full-leaderboard';
import { T200HighscoreLeaderboard, T200PuzzleRushLeaderboard, T200PuzzlesLeaderboard, T200RankedLeaderboard, T200XPLeaderboard } from './src/leaderboards/t200-leaderboard';
import { GetRelativeLeaderboardsRoute } from './src/routes/leaderboard/get-relative-leaderboards-route';
import { CreateSoloRoomRoute } from './src/routes/room/create-solo-room-route';
import { RoomConsumer } from './src/online-users/event-consumers/room-consumer';
import { GetCacheStatsRoute } from './src/routes/stats/get-cache-stats-route';
import { RankedQueueConsumer } from './src/online-users/event-consumers/ranked-queue-consumer';
import { EnterRankedQueueRoute } from './src/routes/room/enter-ranked-queue-route';
import { LeaveRankedQueueRoute } from './src/routes/room/leave-ranked-queue-route';
import { GetUsernamesListRoute } from './src/routes/misc/get-usernames-list-route';
import { InvitationConsumer } from './src/online-users/event-consumers/invitation-consumer';
import { FriendInvitationManager } from './src/invitations/friend-invitation';
import { GetInvitationsRoute } from './src/routes/invitations/get-invitations-route';
import { RemoveFriendRoute } from './src/routes/user/remove-friend-route';
import { UserConsumer } from './src/online-users/event-consumers/user-consumer';
import { GetT200LeaderboardRoute } from './src/routes/leaderboard/get-t200-leaderboard-route';
import { UpdateMeAttributeRoute } from './src/routes/user/update-me-attribute';
import { LeaveRoomRoute } from './src/routes/room/leave-room-route';
import { GetRoomsRoute } from './src/routes/room/get-rooms-route';
import { TaskScheduler } from './src/task-scheduler/task-scheduler';
import { GetGamesRoute } from './src/routes/game/get-games-route';
import { GetGameRoute } from './src/routes/game/get-game-route';
import { handleLogout } from './src/authentication/session-util';
import { registerAsGuest } from './src/authentication/guest-util';
import { passwordLogin, passwordRegister } from './src/authentication/password-util';
import { ServerRestartWarningConsumer } from './src/online-users/event-consumers/server-restart-warning-consumer';
import { SetServerRestartWarningRoute } from './src/routes/misc/set-server-restart-warning-route';
import { ClearUserCacheRoute } from './src/routes/misc/clear-user-cache-route';
import { GetUserCacheRoute } from './src/routes/misc/get-user-cache-route';
import { RatedPuzzleConsumer } from './src/online-users/event-consumers/rated-puzzle-consumer';
import { RequestRatedPuzzleRoute } from './src/routes/puzzles/request-rated-puzzle-route';
import { SubmitRatedPuzzleRoute } from './src/routes/puzzles/submit-rated-puzzle-route';
import { GlobalStatConsumer } from './src/online-users/event-consumers/global-stat-consumer';
import { GetGlobalStatRoute } from './src/routes/misc/get-global-stat-route';
import { BotManager } from './src/bot/bot-manager';
import { OnlineUserCacheConsumer } from './src/online-users/event-consumers/online-user-cache-consumer';
import { GetScoreHistogramRoute } from './src/routes/user-stats/get-score-histogram-route';
import { QuestConsumer } from './src/online-users/event-consumers/quest-consumer';
import { GetUserRoute } from './src/routes/user/get-user-route';
import { GetRatedPuzzleRoute } from './src/routes/puzzles/get-rated-puzzle-route';
import { ActivityConsumer } from './src/online-users/event-consumers/activity-consumer';
import { GetAllActivitiesRoute } from './src/routes/user/get-all-activities-route';
import { GetErrorsRoute } from './src/routes/misc/get-errors-route';
import { GetGlobalChatRoute } from './src/routes/misc/get-global-chat-route';
import { GlobalChatConsumer } from './src/online-users/event-consumers/global-chat-consumer';
import { GetRelativeRanksRoute } from './src/routes/leaderboard/get-relative-ranks';
import { SetStartingTrophiesRoute } from './src/routes/user/set-starting-trophies-route';
import { registerSRBots } from './src/bot/sr-bots';
import { testBotHyperparameters } from './src/bot/simulate-bot';
import { SpectateRoomRoute } from './src/routes/room/spectate-room-route';
import { SpectateRoomOfUserRoute } from './src/routes/room/spectate-room-of-user-route';
import { RankedAbortConsumer } from './src/online-users/event-consumers/ranked-abort-consumer';
import { MatchInvitationManager } from './src/invitations/match-invitation';
import { AnalyticsConsumer } from './src/online-users/event-consumers/analytics-consumer';
import { GetVersionRoute } from './src/routes/misc/get-version-route';
import { GetRankedStatsRoute } from './src/routes/user/get-ranked-stats-route';

// Load environment variables
require('dotenv').config();

async function main() {

  const app = express();
  const port = process.env.PORT || 3000;

  // HTTP server setup
  const server = createServer(app);

  // WebSocket server setup
  const wss = new WebSocketServer({ server });

  // json middleware
  app.use(express.json());

  // logging middleware
  app.use(morgan('dev'))

  // cors middleware
  app.use(cors());

  // Make sure the server is running in a valid environment
  const NODE_ENV = process.env.NODE_ENV as DeploymentEnvironment;
  if (!Object.values(DeploymentEnvironment).includes(NODE_ENV)) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}, must be one of ${Object.values(DeploymentEnvironment)}`);
  }

  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
  console.log(`Starting ${NODE_ENV} server`);

  // Initialize express session middleware
  if (NODE_ENV === DeploymentEnvironment.PRODUCTION) app.set('trust proxy', 1);
  app.use(session({
    secret: DISCORD_CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === DeploymentEnvironment.PRODUCTION,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    } // Set to true if using HTTPS
  }));

  // initialize special auth routes
  app.get('/api/v2/login', redirectToDiscord);
  app.get('/api/v2/callback', handleDiscordCallback);
  app.post('/api/v2/register-as-guest', registerAsGuest);
  app.post('/api/v2/logout', handleLogout);

  app.post('/api/v2/password-register', passwordRegister);
  app.post('/api/v2/password-login', passwordLogin);



  // Initialize singletons
  const users = new OnlineUserManager(wss);
  EventConsumerManager.bootstrap(users);

  // Register consumers
  const consumers = EventConsumerManager.getInstance();
  consumers.registerConsumer(UserConsumer, {});
  consumers.registerConsumer(OnlineUserCacheConsumer, {});
  consumers.registerConsumer(QuestConsumer, {});
  consumers.registerConsumer(FriendEventConsumer, {});
  consumers.registerConsumer(PingConsumer, {});
  consumers.registerConsumer(GuestConsumer, {});
  consumers.registerConsumer(RoomConsumer, {});
  consumers.registerConsumer(RankedQueueConsumer, {});
  consumers.registerConsumer(RankedAbortConsumer, {});
  consumers.registerConsumer(InvitationConsumer, {});
  consumers.registerConsumer(RatedPuzzleConsumer, {batchSize: NODE_ENV === DeploymentEnvironment.DEV ? 3 : 97});
  consumers.registerConsumer(ActivityConsumer, {});
  consumers.registerConsumer(GlobalChatConsumer, {});
  consumers.registerConsumer(ServerRestartWarningConsumer, {});
  consumers.registerConsumer(GlobalStatConsumer, {});
  consumers.registerConsumer(AnalyticsConsumer, { enabled: NODE_ENV !== DeploymentEnvironment.DEV });
  await consumers.init();

  // Initialize OnlineUserCaches
  const onlineUserCacheConsumer = consumers.getConsumer(OnlineUserCacheConsumer);
  //onlineUserCacheConsumer.registerCache(TestUserCache, 5);

  // Initialize InvitationManagers
  const invitationConsumer = consumers.getConsumer(InvitationConsumer);
  invitationConsumer.registerInvitationManager(FriendInvitationManager);
  invitationConsumer.registerInvitationManager(MatchInvitationManager);


  // Initialize leaderboards
  LeaderboardManager.registerFullLeaderboard(FullHighscoreLeaderboard);
  LeaderboardManager.registerFullLeaderboard(FullTrophiesLeaderboard);
  LeaderboardManager.registerFullLeaderboard(FullPuzzlesLeaderboard);
  LeaderboardManager.registerT200Leaderboard(T200XPLeaderboard);
  LeaderboardManager.registerT200Leaderboard(T200HighscoreLeaderboard);
  LeaderboardManager.registerT200Leaderboard(T200RankedLeaderboard);
  LeaderboardManager.registerT200Leaderboard(T200PuzzlesLeaderboard);
  LeaderboardManager.registerT200Leaderboard(T200PuzzleRushLeaderboard);
  await LeaderboardManager.init(users);

  // Schedule tasks
  const scheduler = new TaskScheduler();
  // scheduler.schedule(ExampleTask, 5, TimeUnit.MINUTES);

  // initialize routes
  const routes = new RouteManager(app);
  routes.registerRoute(GetMeRoute);
  routes.registerRoute(GetUserRoute);
  routes.registerRoute(GetOnlineUsersRoute);
  routes.registerRoute(GetFriendsInfoRoute);
  routes.registerRoute(GetAllActivitiesRoute);
  routes.registerRoute(GetAllUsernamesRoute);
  routes.registerRoute(GetRelativeLeaderboardsRoute);
  routes.registerRoute(GetRelativeRanksRoute);
  routes.registerRoute(GetT200LeaderboardRoute);
  routes.registerRoute(GetRoomsRoute);
  routes.registerRoute(CreateSoloRoomRoute);
  routes.registerRoute(GetRankedStatsRoute);
  routes.registerRoute(GetCacheStatsRoute);
  routes.registerRoute(LeaveRoomRoute);
  routes.registerRoute(SetStartingTrophiesRoute);
  routes.registerRoute(EnterRankedQueueRoute);
  routes.registerRoute(LeaveRankedQueueRoute);
  routes.registerRoute(SpectateRoomRoute);
  routes.registerRoute(SpectateRoomOfUserRoute);
  routes.registerRoute(GetUsernamesListRoute);
  routes.registerRoute(GetInvitationsRoute);
  routes.registerRoute(RemoveFriendRoute);
  routes.registerRoute(UpdateMeAttributeRoute);
  routes.registerRoute(GetGamesRoute);
  routes.registerRoute(GetGameRoute);
  routes.registerRoute(SetServerRestartWarningRoute);
  routes.registerRoute(GetUserCacheRoute);
  routes.registerRoute(ClearUserCacheRoute);
  routes.registerRoute(RequestRatedPuzzleRoute);
  routes.registerRoute(SubmitRatedPuzzleRoute);
  routes.registerRoute(GetRatedPuzzleRoute);
  routes.registerRoute(GetGlobalStatRoute);
  routes.registerRoute(GetScoreHistogramRoute);
  routes.registerRoute(GetGlobalChatRoute);
  routes.registerRoute(GetErrorsRoute);
  routes.registerRoute(GetVersionRoute);

  const bots = new BotManager();
  //bots.registerBot(new RankedBotUser('bot2', 2000, {aiConfig : { inputSpeed: InputSpeed.HZ_10 }}));
  //if (NODE_ENV !== DeploymentEnvironment.DEV) registerSRBots(bots);
  registerSRBots(bots);
  await bots.init();

  if (NODE_ENV === DeploymentEnvironment.DEV && false) {
    const results = await testBotHyperparameters();
    fs.writeFileSync("results.json", JSON.stringify(results, null, 2));
  }

  app.get('/api/v2/server-stats', (req: Request, res: Response) => {
    const stats: ServerStats = {
      environment: NODE_ENV as DeploymentEnvironment,
    }
    res.status(200).send(stats);
  });

  // catch all invalid api routes
  app.get('/*', (req, res) => {
      res.status(404).send("Invalid API route");
  });

  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    // sayHello();
  });

}

main();