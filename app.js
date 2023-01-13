const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const databasePath = path.join(__dirname, "twitterClone.db");
const jwt = require("jsonwebtoken");

app.use(express.json());

let database = null;

const initializeAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running");
    });
  } catch (e) {
    console.log(`DB error ${e.message}`);
    process.exit(1);
  }
};
initializeAndServer();

const tweetCamelCase = (each) => {
  return {
    tweet_id: each.tweetId,
    tweet: each.tweet,
    userId: each.user_id,
    dateTime: each.date_time,
  };
};

const userCamelCase = (each) => {
  return {
    userId: each.user_id,
    name: each.name,
    username: each.username,
    password: each.password,
    gender: each.gender,
  };
};

const followerCamelCase = (each) => {
  return {
    followerId: each.follower_id,
    followerUserId: each.follower_user_id,
    followingUserId: each.following_user_id,
  };
};

const replyCamelCase = (each) => {
  return {
    replyId: each.reply_id,
    tweetId: each.tweet_id,
    reply: each.reply,
    userId: each.user_id,
    dateTime: each.date_time,
  };
};

const likeCamelCase = (each) => {
  return {
    likeId: each.like_id,
    tweetId: each.tweet_id,
    userId: each.user_id,
    dateTime: each.date_time,
  };
};

const correctPassword = (password) => {
  return password.length > 5;
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `INSERT INTO user (username,password,name,gender)
      VALUES (
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}'
      );`;

    if (correctPassword(password)) {
      await database.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//api 3
app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  const userTweetsQuery = `SELECT username,tweet,date_time FROM user INNER JOIN tweet ON 
  user.user_id=tweet.user_id
  ORDER BY tweet.date_time DESC LIMIT 4;`;
  const userTweets = await database.all(userTweetsQuery);
  response.send(
    userTweets.map((each) => ({
      username: each.username,
      tweet: each.tweet,
      dateTime: each.date_time,
    }))
  );
});

//api 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const userFollowingQuery = `SELECT * FROM user INNER JOIN follower 
                                ON user.user_id=follower.follower_user_id;`;
  const userFollow = await database.all(userFollowingQuery);
  response.send(userFollow);
});

//api 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const userFollowingQuery = `SELECT name FROM user INNER JOIN follower 
                                ON user.user_id=follower.following_user_id;`;
  const userFollow = await database.all(userFollowingQuery);
  response.send(userFollow);
});

//api 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const userTweetsQuery = `SELECT tweet,date_time FROM user INNER JOIN tweet 
    ON user.user_id = tweet.user_id;`;
  const userTweets = await database.all(userTweetsQuery);
  response.send(
    userTweets.map((each) => ({ tweet: each.tweet, dateTime: each.date_time }))
  );
});

//api 10
app.post("/user/tweets/", async (request, response) => {
  const { tweet } = request.body;
  const tweetPostQuery = `INSERT INTO tweet (tweet) VALUES '${tweet}';`;
  await database.run(tweetPostQuery);
  response.send("Created a Tweet");
});

//api 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    if (authenticateToken) {
      const deleteQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId};`;
      await database.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api 8
app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT name,reply FROM user INNER JOIN reply ON user.user_id = reply.user_id`;
    const reply = await database.get(query);
    response.send(reply);
  }
);

//api 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const tweetIdQuery = `SELECT tweet,date_time AS dateTime FROM tweet INNER JOIN reply
    ON tweet.tweet_id = reply.tweet_id;`;
  const tweets = await database.get(tweetIdQuery);
  response.send(tweets);
});

module.exports = app;
