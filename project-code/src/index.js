const express = require("express");
const app = express();
const pgp = require("pg-promise")();
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");



// db config
const dbConfig = {
  host: "db",
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

// db test
db.connect()
  .then((obj) => {
    // Can check the server version here (pg-promise v10.1.0+):
    console.log("Database connection successful");
    obj.done(); // success, release the connection;
  })
  .catch((error) => {
    console.log("ERROR:", error.message || error);
  });

// set the view engine to ejs
app.set("view engine", "ejs");
app.use(express.static(__dirname + '/')); 
app.use(bodyParser.json());

// set session
app.use(
  session({
    secret: "XASDASDA",
    saveUninitialized: true,
    resave: true,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.get("/", (req, res) => {
    res.render("pages/home.ejs");
});

app.get("/login", (req, res) => {
    res.render("pages/login.ejs");
});

app.post("/login", async (req, res) => {
  if (req.body.username == undefined || req.body.password == undefined || req.body.username.length == 0 || req.body.password.length == 0){
      res.render("pages/login", {message: "Please enter a username and password.", error: true});
      return true;
  }

  var user_sql = "SELECT * FROM users WHERE username = $1";
  var username = req.body.username;
  if (/^.+@.+\..+$/.test(req.body.username)) { //log in with email
    user_sql = "SELECT * FROM users WHERE email = $1";
    username = username.toLowerCase();
  }

  var user = null;
  try {
    user = await db.any(user_sql, [username]);
    if (user.length == 0){
        res.render("pages/login", {message: "Incorrect username or password.", error: true});
        return true;
    }
  }
  catch(ex) {
    res.render("pages/login", {message: "An internal error occured.", error: true});
    console.error(ex);
    return true;
  }

  const match = await bcrypt.compare(req.body.password, user[0].password);

  if (match){
      req.session.user = user[0];
      req.session.save();
      return res.redirect("/kitchen");
  } else {
      res.render("pages/login", {message: "Incorrect username or password.", error: true});
  }
})

app.get("/register", (req, res) => {
    res.render("pages/register.ejs");
})

app.get('/kitchen', (req, res) => {
  res.render("pages/kitchen.ejs");
});

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// aws bedrock api call


// maybe there's a better way to do this,
// not sure tho as I'm still figuring it out
const AWS = require("aws-sdk");

// Configure AWS with credentials
// probably need to find a safer way to do this
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Creating the bedrock service object
const bedrock = new AWS.BedrockRuntime();

// parses JSON-formatted request bodies 
// makes the data readily available in a structured format under req.body
app.use(bodyParser.json());

// Defining the Bedrock API route
app.post("/api/bedrock", async (req, res) => {
  const { query } = req.body; // collecting the query params from body, this will be passed to the ai model

  // query changes will need to be made, context before and other inputs will need to be added.
  // We can work this out as a group to our liking
  try {
    const params = {
      accept: 'application/json',
      body: JSON.stringify({
        prompt: query
      }),
      contentType: 'application/json',
      modelId: 'anthropic.claude-instant-v1', // could be replaced with claude v2, we'll see what works best :)
    };

    const result = await bedrock.invokeModel(params).promise();
    res.status(200).json(result); // we'll use this  to display result later
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error invoking the model' });
  }
});

app.listen(3000);
console.log("Server listening on port 3000");