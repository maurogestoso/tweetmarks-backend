## Twitter Auth spike

Disclaimer: I don't know what I'm doing, that's why I'm spiking this. The goal of this post is to show my thinking process and how I learn new things. That means that there's going to be a lot of incorrect assumptions, omissions and general ignorance for most of the text. Hopefully by the end I will learn something...

### Goal

Users login with Twitter and we get access to auth tokens server side to request user data

### Technology choices

I want to build an app with Next.js. Mainly Node and React. Database technology shouldn't be complicated because data will be very simple (not a lot of relations, just Users and Tweets to start with). I'd like to have good search functionality down the line, so keeping it simple to start with might make it easier to refactor later.

### My Understanding

1. User clicks on sign in
2. Request "request token" from Twitter
3. Redirect user to Twitter sign in page (with request token)
4. User enters Twitter credentials and grants permissions to our app
5. Twitter redirects to a page in our app with tokens

### Things I tried

- Tried requesting the request token from the client but the Twitter API doesn't allow CORS, so all requests to the Twitter API will have to be done server side
- Created a separate server to my Next.js app to act as an authentication microservice but run into trouble redirecting the Next.js app. Seemed too complicated for a simple app.
- Found an Express + Next.js example that allows me to add endpoints apart from the Next.js handled pages. Perfect for what I want.
- Run into trouble making an OAuth request to Twitter, getting back a 400 saying I'm giving "bad" auth data. I think it has to do with the way the OAuth part of the request is signed, will require more research and possibly using a library.
- Doing some research I found the page on the Twitter documentation that describes the process for creating an OAuth signature (https://developer.twitter.com/en/docs/basics/authentication/guides/creating-a-signature.html). It's not hard, but it is a long and complex process that someone must have figured out already, so it's time to find a library to help me. Candidates: [oauth](https://www.npmjs.com/package/oauth) ([Example](https://gist.github.com/joshj/1933640)), [twitter](https://www.npmjs.com/package/twitter) and [node-twitter](https://www.npmjs.com/package/node-twitter-api)
- Reading the [OAuth specification](https://oauth.net/core/1.0/#anchor9) it makes a lot of sense that you need secret information to sign your request. It also explains why it's not a good idea to make this request from the client, you wouldn't want to expose your application's secret keys. Turns out the Twitter devs are not being obnoxious.
