import { Component, HostListener, OnDestroy } from '@angular/core';
import { BehaviorSubject, debounceTime, filter, map, Subscription } from 'rxjs';
import { getDisplayKeybind } from 'src/app/components/ui/editable-keybind/editable-keybind.component';
import { ButtonColor } from 'src/app/components/ui/solid-selector/solid-selector.component';
import { FetchService, Method } from 'src/app/services/fetch.service';
import { GamepadService } from 'src/app/services/gamepad.service';
import { MeService } from 'src/app/services/state/me.service';


abstract class Setting {
  public abstract readonly key: string;
}

class Category {
  constructor(
    public readonly name: string,
    public readonly settings: Setting[],
  ) { }
}

class Tab {
  constructor(
    public readonly name: string,
    public readonly categories: Category[],
  ) { }
}

class BooleanSetting extends Setting {
  constructor(
    public readonly key: string,
    public readonly label: string,
    public readonly description?: string,
  ) { super() }
}

class KeybindSetting extends Setting {
  constructor(
    public readonly key: string,
    public readonly label: string,
  ) { super() }
}

class DropdownSetting extends Setting {
  constructor(
    public readonly key: string,
    public readonly label: string,
    public readonly options: { [attribute: string]: string },
    public readonly description?: string,
  ) { super() }
}

class ParagraphSetting extends Setting {

  // if null, not edited yet
  private readonly paragraph$ = new BehaviorSubject<string | null>(null);

  public maxChars$ = this.paragraph$.pipe(
    map(paragraph => paragraph === null ? null : this.maxChars - paragraph.length)
  );
  public maxCharsRed$ = this.maxChars$.pipe(
    map(maxChars => maxChars === null ? false : maxChars < 0)
  );

  constructor(
    private readonly component: SettingsPageComponent,
    public readonly key: string,
    public readonly label: string,
    public readonly maxChars: number,
    public readonly description?: string,
  ) {
    super();

    // Send changes in paragraph
    this.component.subscriptions.push(this.paragraph$.pipe(
      filter(paragraph => paragraph !== null && paragraph.length <= this.maxChars),
      debounceTime(400)
    ).subscribe(paragraph => {
      console.log("send", paragraph);
      this.component.setAttribute(undefined, this.key, paragraph);
    }))
  }

  edit(event: Event) {
    const newParagraph = (event.target as HTMLTextAreaElement).value;
    this.paragraph$.next(newParagraph);
  }


}


@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.scss']
})
export class SettingsPageComponent implements OnDestroy {

  public readonly subscriptions: Subscription[] = [];

  isBooleanSetting = (setting: Setting) => (setting instanceof BooleanSetting) ? (setting as BooleanSetting) : null;
  isDropdownSetting = (setting: Setting) => (setting instanceof DropdownSetting) ? (setting as DropdownSetting) : null;
  isKeybindSetting = (setting: Setting) => (setting instanceof KeybindSetting) ? (setting as KeybindSetting) : null;
  isParagraphSetting = (setting: Setting) => (setting instanceof ParagraphSetting) ? (setting as ParagraphSetting) : null;

  readonly tabs: Tab[] = [
    new Tab('Profile', [
      new Category('Identity', [
        new ParagraphSetting(
          this,
          'about_me',
          'About me',
          400,
          'Give your profile page some flair with a little something about you!'
        )
      ])
    ]),
    new Tab('Gameplay', [
      new Category('Friends', [
        new BooleanSetting('enable_receive_friend_requests', 'Allow people to send me friend requests'),
        new BooleanSetting('notify_on_friend_online', 'Notify me when friends go online'),
      ]),
      new Category('Games', [
        new BooleanSetting(
          'disable_midgame_quests',
          'Disable mid-game quest popups',
          'Delay potentially-distracting quest completion popups from showing until the end of the game'
        ),
        new BooleanSetting(
          'show_live_analysis',
          'Show live analysis',
          'Enables a live evaluation bar and accuracy panel'
        ),
        new BooleanSetting(
          'enable_runahead',
          'Enable emulator runahead',
          'Runahead reduces latency but requires more CPU power. It is recommended to disable runahead if you are experiencing performance issues.'
        ),
      ]),
      new Category('Ranked', [
        new BooleanSetting(
          'allow_bot_opponents',
          'Allow bot opponents',
          'Allow matching against bots in ranked matches to reduce queuing times when fewer players are online'
        ),
      ]),
      new Category('Sound', [
        new BooleanSetting('enable_sound', 'Play sound effects'),
      ]),
    ]),
    new Tab('Keybinds', [
      new Category('Games', [
        new KeybindSetting('keybind_emu_start', 'Start'),
        new KeybindSetting('keybind_emu_up', 'Up'),
        new KeybindSetting('keybind_emu_down', 'Down'),
        new KeybindSetting('keybind_emu_move_left', 'Move Left'),
        new KeybindSetting('keybind_emu_move_right', 'Move Right'),
        new KeybindSetting('keybind_emu_rot_left', 'Rotate Left'),
        new KeybindSetting('keybind_emu_rot_right', 'Rotate Right'),
        new KeybindSetting('keybind_emu_reset', 'Restart'),

      ]),
      new Category('Puzzles', [
        new KeybindSetting('keybind_puzzle_rot_left', 'Rotate Left'),
        new KeybindSetting('keybind_puzzle_rot_right', 'Rotate Right'),
      ]),
    ])
  ]

  public me$ = this.meService.get$();
  public currentTab$ = new BehaviorSubject<Tab>(this.tabs[0]);
  public activeKey$ = new BehaviorSubject<string | null>(null);
  public errorKeybindExists$ = new BehaviorSubject<string | null>(null);

  readonly getDisplayKeybind = getDisplayKeybind;
  readonly ButtonColor = ButtonColor;

  private fadeTimeout: any;

  private gamepadSubscription: any;

  constructor(
    private meService: MeService,
    private fetchService: FetchService,
    private gamepadService: GamepadService,
  ) {
    this.gamepadSubscription = this.gamepadService.onPress().subscribe((button: string) => {
      this.onKeyDown(button);
    });
  }

  ngOnDestroy() {
    this.gamepadSubscription.unsubscribe();

    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  getAttribute(user: any, key: string) {
    if (user[key] === undefined) throw new Error(`User does not have attribute ${key}`);
    return user[key];
  }

  async setAttribute(user: any | undefined, attribute: string, value: any) {
    if (user !== undefined && user[attribute] === undefined) throw new Error(`User does not have attribute ${attribute}`);
    console.log(`Setting ${attribute} to ${value}`);

    await this.fetchService.fetch(Method.POST, "/api/v2/update-attribute", { attribute, value });
  }

  // Search for a keybind label by key
  getLabelForKey(key: string) {
    const setting = this.tabs.flatMap(tab => tab.categories).flatMap(category => category.settings).find(setting => setting.key === key);
    if (setting instanceof KeybindSetting) return setting.label;
    throw new Error(`No keybind setting found for key ${key}`);
  }

  // return all the option values for a dropdown setting
  getDropdownLabels(setting: DropdownSetting) {
    return Object.values(setting.options);
  }

  getDropdownIndex(user: any, setting: DropdownSetting) {
    const attributeValue = this.getAttribute(user, setting.key);
    return Object.keys(setting.options).indexOf(attributeValue);
  }

  setDropdownIndex(user: any, setting: DropdownSetting, index: number) {
    const value = Object.keys(setting.options)[index];
    this.setAttribute(user, setting.key, value);
  }

  private keybindsEqual(keybind1: string, keybind2: string) {
    return keybind1.toLowerCase() === keybind2.toLowerCase();
  }

  // Whether a some key is already bound to a keybind with attributeValue
  doesKeybindExist(user: any, key: string, attributeValue: string): boolean {

    // get the category that the key belongs to
    const category = this.tabs.flatMap(tab => tab.categories).find(category => category.settings.some(setting => setting.key === key));

    // get the settings in the category
    const settings = category!.settings;

    //const settings = this.tabs.flatMap(tab => tab.categories).flatMap(category => category.settings).filter(setting => setting instanceof KeybindSetting);
    return settings.some(setting => this.keybindsEqual(this.getAttribute(user, setting.key), attributeValue));
  }

  editKeybind(key: string) {
    this.errorKeybindExists$.next(null);
    this.activeKey$.next(key);
  }

  cancelKeybindEdit() {
    this.activeKey$.next(null);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    this.onKeyDown(event.key);
  }

  private onKeyDown(key: string) {
    // If no keybind is being edited, ignore
    const activeKey = this.activeKey$.getValue();
    if (!activeKey) return;

    const user = this.meService.getSync()!;

    // If already that keybind, ignore
    const currentKeybind = this.getAttribute(user, activeKey);
    if (this.keybindsEqual(currentKeybind, key)) {
      this.activeKey$.next(null);
      return;
    }

    // If keybind already exists, set error
    if (this.doesKeybindExist(this.meService.getSync()!, activeKey, key)) {
      this.errorKeybindExists$.next(null);
      setTimeout(() => {
        this.errorKeybindExists$.next(key);
        clearTimeout(this.fadeTimeout);
        this.fadeTimeout = setTimeout(() => this.errorKeybindExists$.next(null), 1000);
      }, 0);

      console.log('Keybind already exists');
      return;
    }

    // If key is a gamepad key and keybind is for puzzle, ignore
    if (activeKey.startsWith("keybind_puzzle") && key.startsWith("Gamepad")) {
      this.activeKey$.next(null);
      console.log('Gamepad not avalible for puzzles');
      return;
    }

    // Set the keybind
    this.setAttribute(user, activeKey, key);
    this.activeKey$.next(null);
  }

  maxChars(user: any, setting: ParagraphSetting) {
    const attribute = this.getAttribute(user, setting.key);
    const length = attribute ? attribute.length : 0;
    return setting.maxChars - length;
  }

}
