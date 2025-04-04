import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { NotifierModule, NotifierOptions } from 'angular-notifier';
import { SidebarComponent } from './components/layout/root/sidebar/sidebar.component';
import { PlayPageComponent } from './components/layout/play/play-page/play-page.component';
import { SidebarTabComponent } from './components/layout/root/sidebar-tab/sidebar-tab.component';
import { SignOutComponent } from './components/layout/root/sign-out/sign-out.component';
import { ProfileTabComponent } from './components/layout/root/profile-tab/profile-tab.component';
import { PingIconComponent } from './components/layout/root/ping-icon/ping-icon.component';
import { GoogleSigninComponent } from './components/ui/google-signin/google-signin.component';
import { SolidButtonComponent } from './components/ui/solid-button/solid-button.component';
import { FriendPageComponent } from './components/layout/friends/friend-page/friend-page.component';
import { ModalComponent } from './components/ui/modal/modal.component';
import { XComponent } from './components/ui/x/x.component';
import { ClickOutsideDirective } from './directives/click-outside.directive';
import { AddFriendModalComponent } from './components/layout/friends/add-friend-modal/add-friend-modal.component';
import { FriendIconComponent } from './components/layout/friends/friend-icon/friend-icon.component';
import { FriendElementComponent } from './components/layout/friends/friend-element/friend-element.component';
import { OnlineIndicatorComponent } from './components/ui/online-indicator/online-indicator.component';
import { NesPanelComponent } from './components/nes-layout/nes-panel/nes-panel.component';
import { NesBoardComponent } from './components/nes-layout/nes-board/nes-board.component';
import { NesBlockComponent } from './components/nes-layout/nes-block/nes-block.component';
import { OutlineButtonComponent } from './components/ui/outline-button/outline-button.component';
import { LayoutOneComponent } from './components/nes-layout/layouts/layout-one/layout-one.component';
import { NesPieceComponent } from './components/nes-layout/nes-piece/nes-piece.component';
import { VideoCaptureComponent } from './components/ocr/video-capture/video-capture.component';
import { ModalContainerComponent } from './components/ui/modal-container/modal-container.component';
import { CalibrateOcrModalComponent } from './components/modals/calibrate-ocr-modal-components/calibrate-ocr-modal/calibrate-ocr-modal.component';
import { StepperComponent } from './components/ui/stepper/stepper.component';
import { TooltipDirective } from './directives/tooltip.directive';
import { TooltipComponent } from './components/ui/tooltip/tooltip.component';
import { PreviewCanvasComponent } from './components/modals/calibrate-ocr-modal-components/preview-canvas/preview-canvas.component';
import { PlayPuzzlePageComponent } from './components/layout/play-puzzle/play-puzzle-page/play-puzzle-page.component';
import { TimerComponent } from './components/layout/play-puzzle/timer/timer.component';
import { PuzzleNesBoardComponent } from './components/layout/play-puzzle/puzzle-nes-board/puzzle-nes-board.component';
import { EloRatingComponent } from './components/layout/play-puzzle/elo-rating/elo-rating.component';
import { LeaderboardComponent } from './components/layout/play-puzzle/leaderboard/leaderboard.component';
import { LoadingAnimationComponent } from './components/ui/loading-animation/loading-animation.component';
import { EloGraphComponent } from './components/layout/play-puzzle/elo-graph/elo-graph.component';
import { AppRoutingModule } from './app-routing.module';
import { FullscreenLayoutComponent } from './components/layout/root/fullscreen-layout/fullscreen-layout.component';
import { MainLayoutComponent } from './components/layout/root/main-layout/main-layout.component';
import { RouterModule } from '@angular/router';
import { ReviewPageComponent } from './components/layout/review/review-page/review-page.component';
import { TabSelectorComponent } from './components/ui/tab-selector/tab-selector.component';
import { AuthModalComponent } from './components/modals/auth-modal/auth-modal.component';
import { FullscreenExitButtonComponent } from './components/ui/fullscreen-exit-button/fullscreen-exit-button.component';
import { RatingStarsComponent } from './components/ui/rating-stars/rating-stars.component';
import { FeedbackThumbsComponent } from './components/ui/feedback-thumbs/feedback-thumbs.component';
import { ChallengeModalComponent } from './components/modals/challenge-modal/challenge-modal.component';
import { ChallengeComponent } from './components/layout/friends/challenge/challenge.component';
import { NesEmulatorMenuComponent } from './components/nes-layout/nes-emulator-menu/nes-emulator-menu.component';
import { LoggerComponent } from './components/misc/logger/logger.component';
import { LearnPageComponent } from './components/layout/learn/learn-page/learn-page.component';
import { DashboardComponent } from './components/layout/learn/dashboard/dashboard.component';
import { LessonComponent } from './components/layout/learn/lesson/lesson.component';
import { LoginPageComponent } from './components/layout/login/login-page/login-page.component';
import { MainLeaderboardPageComponent } from './components/layout/main-leaderboard/main-leaderboard-page/main-leaderboard-page.component';
import { WelcomePageComponent } from './components/layout/welcome/welcome-page/welcome-page.component';
import { ControlPanelPageComponent } from './components/layout/control-panel/control-panel-page/control-panel-page.component';
import { SettingsPageComponent } from './components/layout/settings/settings-page/settings-page.component';
import { ProgressBarComponent } from './components/layout/learn/progress-bar/progress-bar.component';
import { LessonCardComponent } from './components/layout/learn/lesson-card/lesson-card.component';
import { BannersComponent } from './components/layout/root/banners/banners.component';
import { GameOverComponent } from './components/nes-layout/game-over/game-over.component';
import { BoardEditorComponent } from './components/layout/control-panel/board-editor/board-editor.component';
import { StatPanelComponent } from './components/layout/main-leaderboard/stat-panel/stat-panel.component';
import { LeaderboardTableComponent } from './components/ui/table/leaderboard-table.component';
import { MatchmakingLoadingPageComponent } from './components/layout/multiplayer/matchmaking-loading-page/matchmaking-loading-page.component';
import { LoadingScreenComponent } from './components/layout/multiplayer/loading-screen/loading-screen.component';
import { SolidSelectorComponent } from './components/ui/solid-selector/solid-selector.component';
import { NgOptimizedImage } from '@angular/common';
import { RoomComponent } from './components/layout/room/room/room.component';
import { SoloRoomComponent } from './components/layout/room/solo-room/solo-room.component';
import { ChatComponent } from './components/layout/room/chat/chat.component';
import { RoomModalComponent } from './components/layout/room/modals/room-modal/room-modal.component';
import { SoloBeforeGameModalComponent } from './components/layout/room/modals/solo-before-game-modal/solo-before-game-modal.component';
import { SoloAfterGameModalComponent } from './components/layout/room/modals/solo-after-game-modal/solo-after-game-modal.component';
import { LeagueIconComponent } from './components/ui/league-icon/league-icon.component';
import { AlertContainerComponent } from './components/alerts/alert-container/alert-container.component';
import { TestAlertComponent } from './components/alerts/test-alert/test-alert.component';
import { AlertComponent } from './components/alerts/alert/alert.component';
import { QuestAlertComponent } from './components/alerts/quest-alert/quest-alert.component';
import { QuestComponent } from './components/ui/quest/quest.component';
import { MultiplayerRoomComponent } from './components/layout/room/multiplayer-room/multiplayer-room.component';
import { TrophiesComponent } from './components/ui/trophies/trophies.component';
import { GameHeaderComponent } from './components/layout/room/game-header/game-header.component';
import { HighestScoreComponent } from './components/ui/highest-score/highest-score.component';
import { PuzzleEloComponent } from './components/ui/puzzle-elo/puzzle-elo.component';
import { FriendRequestComponent } from './components/layout/friends/friend-request/friend-request.component';
import { MultiplayerAfterMatchModalComponent } from './components/layout/room/modals/multiplayer-after-match-modal/multiplayer-after-match-modal.component';
import { GameSummaryGraphComponent } from './components/ui/game-summary-graph/game-summary-graph.component';
import { XpInfoComponent } from './components/ui/xp-info/xp-info.component';
import { ModeIconComponent } from './components/ui/mode-icon/mode-icon.component';
import { EvalBarComponent } from './components/ui/eval-bar/eval-bar.component';
import { SlideToggleComponent } from './components/ui/slide-toggle/slide-toggle.component';
import { EditableKeybindComponent } from './components/ui/editable-keybind/editable-keybind.component';
import { TrophyAlertComponent } from './components/alerts/trophy-alert/trophy-alert.component';
import { PageTitleComponent } from './components/ui/page-title/page-title.component';
import { GameAnalysisComponent } from './components/layout/game-analysis/game-analysis/game-analysis.component';
import { XpStatusComponent } from './components/ui/xp-status/xp-status.component';
import { QuestListModalComponent } from './components/modals/quest-list-modal/quest-list-modal.component';
import { ProfileModalComponent } from './components/modals/profile-modal/profile-modal.component';
import { OcrButtonComponent } from './components/ui/ocr-button/ocr-button.component';
import { OcrLayoutComponent } from './components/modals/calibrate-ocr-modal-components/ocr-layout/ocr-layout.component';
import { CorrectnessIconComponent } from './components/ui/correctness-icon/correctness-icon.component';
import { MainChatComponent } from './components/main-chat/main-chat.component';
import { ChatTextEntryComponent } from './components/ui/chat-text-entry/chat-text-entry.component';
import { LockedIconComponent } from './components/ui/locked-icon/locked-icon.component';
import { SelectStartingTrophiesModalComponent } from './components/modals/select-starting-trophies-modal/select-starting-trophies-modal.component';
import { RangeComponent } from './components/modals/select-starting-trophies-modal/range/range.component';
import { ClickSoundDirective } from './directives/click-sound.directive';
import { TvComponent } from './components/tv/tv.component';
import { TvRoomComponent } from './components/tv/tv-room/tv-room.component';
import { ExpandComponent } from './components/ui/expand/expand.component';
import { RankedStatComponent } from './components/ui/ranked-stat/ranked-stat.component';
import { LaunchPageComponent } from './components/layout/launch-page/launch-page.component';
import { GeneratePuzzlesModalComponent } from './components/modals/generate-puzzles-modal/generate-puzzles-modal.component';
import { RabbitLoadingAnimationComponent } from './components/ui/rabbit-loading-animation/rabbit-loading-animation.component';
import { UsernameComponent } from './components/ui/username/username.component';
const customNotifierOptions: NotifierOptions = {
  position: {
    horizontal: {
      position: 'right',
      distance: 12,
    },
    vertical: {
      position: 'bottom',
      distance: 12,
      gap: 10,
    },
  },
  theme: 'material',
  behaviour: {
    autoHide: false,
    onClick: 'hide',
    onMouseover: 'pauseAutoHide',
    showDismissButton: true,
    stacking: 4,
  },
  animations: {
    enabled: true,
    show: {
      preset: 'slide',
      speed: 300,
      easing: 'ease',
    },
    hide: {
      preset: 'fade',
      speed: 300,
      easing: 'ease',
      offset: 50,
    },
    shift: {
      speed: 300,
      easing: 'ease',
    },
    overlap: 150,
  },
};

@NgModule({
  declarations: [
    AppComponent,
    SidebarComponent,
    SidebarTabComponent,
    PlayPageComponent,
    SignOutComponent,
    ProfileTabComponent,
    PingIconComponent,
    GoogleSigninComponent,
    SolidButtonComponent,
    SolidSelectorComponent,
    FriendPageComponent,
    ModalComponent,
    XComponent,
    AddFriendModalComponent,
    ClickOutsideDirective,
    FriendIconComponent,
    FriendElementComponent,
    OnlineIndicatorComponent,
    NesPanelComponent,
    NesBoardComponent,
    NesBlockComponent,
    OutlineButtonComponent,
    LayoutOneComponent,
    NesPieceComponent,
    VideoCaptureComponent,
    ModalContainerComponent,
    CalibrateOcrModalComponent,
    StepperComponent,
    TooltipDirective,
    TooltipComponent,
    PreviewCanvasComponent,
    PlayPuzzlePageComponent,
    TimerComponent,
    PuzzleNesBoardComponent,
    EloRatingComponent,
    LeaderboardComponent,
    LoadingAnimationComponent,
    EloGraphComponent,
    FullscreenLayoutComponent,
    MainLayoutComponent,
    ReviewPageComponent,
    TabSelectorComponent,
    AuthModalComponent,
    FullscreenExitButtonComponent,
    RatingStarsComponent,
    FeedbackThumbsComponent,
    ChallengeModalComponent,
    ChallengeComponent,
    NesEmulatorMenuComponent,
    LoggerComponent,
    LearnPageComponent,
    DashboardComponent,
    LessonComponent,
    LoginPageComponent,
    MainLeaderboardPageComponent,
    WelcomePageComponent,
    ControlPanelPageComponent,
    SettingsPageComponent,
    ProgressBarComponent,
    LessonCardComponent,
    BannersComponent,
    GameOverComponent,
    BoardEditorComponent,
    StatPanelComponent,
    LeaderboardTableComponent,
    MatchmakingLoadingPageComponent,
    LoadingScreenComponent,
    RoomComponent,
    SoloRoomComponent,
    ChatComponent,
    RoomModalComponent,
    SoloBeforeGameModalComponent,
    SoloAfterGameModalComponent,
    LeagueIconComponent,
    AlertContainerComponent,
    TestAlertComponent,
    AlertComponent,
    QuestAlertComponent,
    QuestComponent,
    MultiplayerRoomComponent,
    TrophiesComponent,
    GameHeaderComponent,
    HighestScoreComponent,
    PuzzleEloComponent,
    FriendRequestComponent,
    MultiplayerAfterMatchModalComponent,
    GameSummaryGraphComponent,
    XpInfoComponent,
    ModeIconComponent,
    EvalBarComponent,
    SlideToggleComponent,
    EditableKeybindComponent,
    TrophyAlertComponent,
    PageTitleComponent,
    GameAnalysisComponent,
    XpStatusComponent,
    QuestListModalComponent,
    ProfileModalComponent,
    OcrButtonComponent,
    OcrLayoutComponent,
    CorrectnessIconComponent,
    MainChatComponent,
    ChatTextEntryComponent,
    LockedIconComponent,
    SelectStartingTrophiesModalComponent,
    RangeComponent,
    ClickSoundDirective,
    TvComponent,
    TvRoomComponent,
    ExpandComponent,
    RankedStatComponent,
    LaunchPageComponent,
    GeneratePuzzlesModalComponent,
    RabbitLoadingAnimationComponent,
    UsernameComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    NotifierModule.withConfig(customNotifierOptions),
    HttpClientModule,
    RouterModule,
    NgOptimizedImage,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}