import { Injectable } from '@angular/core';
import { FetchService, Method } from './fetch.service';
import { RELEASE_HASH, Version } from '../shared/version';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ForceReloadService {

  constructor(
    private readonly fetchService: FetchService,
    private readonly router: Router,
  ) {
    console.log(`CLIENT HASH`, RELEASE_HASH);
    this.verifyVersionHash();
  }

  public async verifyVersionHash() {
    const { hash } = await this.fetchService.fetch<Version>(Method.GET, `/api/v2/version`);
    if ( RELEASE_HASH === hash ) console.log(`SERVER HASH VERIFIED`);
    else {
      console.log("SERVER HASH MISMATCH:", RELEASE_HASH);
      this.forceReload();
    }
  }

  private forceReload() {

    // Get the current route URL
    const currentUrl = this.router.url.split('?')[0];
    
    // Generate a random query parameter to bypass cache
    const randomQueryParam = `refresh=${Math.random()}`;

    // Perform a hard refresh by navigating to the URL with the random query parameter
    this.router.navigate([currentUrl], { queryParams: { [randomQueryParam]: '' }, replaceUrl: true }).then(() => {
        window.location.reload(); // Force the browser to reload the page completely
    });
    
  }
}
