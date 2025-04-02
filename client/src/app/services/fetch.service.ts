import { Injectable, Injector, isDevMode } from '@angular/core';
import { WebsocketService } from './websocket.service';

export class HTTPError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`HTTP error! status: ${status}, statusText: ${statusText}`);
  }
}

export enum Method {
  POST = 'POST',
  GET = 'GET',
  DELETE = 'DELETE',
  PUT = 'PUT',
}


@Injectable({
  providedIn: 'root'
})
export class FetchService {

  constructor(
    private injector: Injector
  ) { }


  private getBaseURL(): string {

    // In dev mode, force the base URL to be localhost:3000
    //const port = isDevMode() ? 3000 : window.location.port;
    const port = window.location.port;

    return window.location.protocol + '//' + window.location.hostname + (port ? (':' + port) : '');
  }

  // fetches from server and returns the response with generic-defined type
  // if websocket is provided and reponse is 401, tell the websocket to logout
  public async fetch<ResponseType>(
    method: Method,
    urlStr: string,
    content: any = undefined,
  ): Promise<ResponseType> {

    let url = new URL(urlStr, this.getBaseURL());
    let json: string | undefined = undefined;

    if (content) {
        if (method === Method.POST) {
            json = JSON.stringify(content);
        } else {
            for (const [key, value] of Object.entries(content)) {
                // console.log(key, value);
                url.searchParams.append(key, value as string);
            }
        }
    }
    
    const response = await fetch( url.toString(), {
        method: method.toString(),
        headers: {'Content-Type': 'application/json'},
        body: json
    });

    // if the response is 401, tell the websocket to logout
    if (response.status === 401) {
      console.log(`Logging out due to 401 response from ${urlStr}`);
      await this.injector.get(WebsocketService).logout();
    }

    // Server is down, try reload every 5 seconds
    if (response.status === 502) {
      setTimeout(() => location.reload(), 5000);
    }

    if (!response.ok) {
      
      let errorMessage = response.statusText; // Default to status text
  
      try {
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
          }
        } else {
          errorMessage = await response.text(); // Handle plain text errors
        }
      } catch (e) {
        console.warn("Failed to parse error response", e);
      }

      throw new HTTPError(response.status, errorMessage);
    }
    
    const result = await response.json();
    return result as ResponseType;
  }

  // fetches from server and returns the response with generic-defined type


}
