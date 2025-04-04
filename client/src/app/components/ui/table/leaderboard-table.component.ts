import { KeyValue } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { ResourceIDType, T200LeaderboardRow } from 'src/app/shared/models/leaderboard';
import { League } from 'src/app/shared/nestris-org/league-system';
import { ButtonColor } from '../solid-button/solid-button.component';
import { FriendsService } from 'src/app/services/state/friends.service';
import { ModalManagerService, ModalType } from 'src/app/services/modal-manager.service';
import { ProfileModalConfig } from '../../modals/profile-modal/profile-modal.component';
import { BehaviorSubject } from 'rxjs';

const EXPANDED_THRESHOLD = 550;


@Component({
  selector: 'app-leaderboard-table',
  templateUrl: './leaderboard-table.component.html',
  styleUrls: ['./leaderboard-table.component.scss']
})
export class LeaderboardTableComponent implements OnChanges {
  // An ordered list of rows, with each row containing a key for each attribute name
  @Input() rows: T200LeaderboardRow[] = [];

  @Input() resourceIDType: ResourceIDType | null = null;

  @Input() sortByAttribute!: string;

  // A ordered map of attribute name to display name for each column on the table
  // Each TableRow should contain a key for each attribute name
  @Input() attributes: { [key: string]: string } = {};

  // A map of column attribute name to a function that takes in a numeric cell value and returns a color
  // Otherwise, text will be defaulted to white
  @Input() colorRules: { [key: string]: (value: number) => string } = {};

  // A map of column attribute name to a function that takes in a cell value and returns a formatted display string
  // Otherwise, the cell value will be displayed as is
  @Input() formatRules: { [key: string]: (value: any) => string } = {};

  // The row to highlight on the table, if it exists
  @Input() myID?: string;

  @Input() showLeague: boolean = false;
  @Input() showTitle: boolean = true;

  readonly HIGHEST_RANK = 200;

  readonly parseInt = parseInt;
  readonly ButtonColor = ButtonColor;

  readonly onlineFriends$ = this.friendService.get$();

  isExpanded$ = new BehaviorSubject<boolean>(window.innerWidth > EXPANDED_THRESHOLD);

  constructor(
    private readonly friendService: FriendsService,
    private readonly modalManagerService: ModalManagerService,
  ) {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  ngOnChanges(): void {
    console.log('table changes', this.rows);
  }

  // Preserve original property order
  originalOrder = (a: KeyValue<string,string>, b: KeyValue<string,string>): number => {
    return 0;
  }

  getRowAttribute(row: T200LeaderboardRow, attribute: string): any {
    const value = (row as any)[attribute];

    // Return formatted value if a format rule exists
    if (this.formatRules[attribute]) {
      return this.formatRules[attribute](value);
    }

    // Otherwise, return the value as is
    return value;
  }

  getCellColor(row: T200LeaderboardRow, attribute: string): string {
    const value = (row as any)[attribute];

    // Return color if a color rule exists
    if (this.colorRules[attribute]) {
      return this.colorRules[attribute](value);
    }

    // Otherwise, default to white
    return 'white';
  }

  gridTemplateColumns(isExpanded: boolean): string {
    if (!isExpanded) {
      if (!this.resourceIDType) return "1fr 100px";
      return "230px 1fr 50px";
    }
    let str = `35% repeat(${Object.keys(this.attributes).length}, 1fr)`;
    if (this.resourceIDType) str += ' 40px';
    return str;
  }

  getDigitClassname(num: number): string {
    const numDigits = num.toString().length;
    return `digit-${numDigits}`;
  }

  viewProfile(userid: string) {
    const config: ProfileModalConfig = { userid };
    this.modalManagerService.showModal(ModalType.PROFILE, config);
  }


  private onResize() {
    const isWide = window.innerWidth > EXPANDED_THRESHOLD;
    if (this.isExpanded$.value !== isWide) {
      this.isExpanded$.next(isWide);
    }
  }

}