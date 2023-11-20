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
        res.status(400);
        res.render("pages/login", {message: "Incorrect username or password.", error: true});
        return true;
    }
  }
  catch(ex) {
    res.status(400);
    res.render("pages/login", {message: "An internal error occured.", error: true});
    console.error(ex);
    return true;
  }

  const match = await bcrypt.compare(req.body.password, user[0].password);

  if (match){
      req.session.user = user[0];
      req.session.save();
      res.status(200);
      res.redirect('/kitchen');

    } else {
      res.status(400);
      res.render("pages/login", {message: "Incorrect username or password.", error: true});
  }
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
  const { query } = req.body.prompt; // collecting the query params from body, this will be passed to the ai model

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

// Authentication middleware.

app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const query = 'INSERT INTO users(email, username, password) VALUES ($1,$2,$3)';
  console.log(req.body.email)
  const query2 = `SELECT * FROM users WHERE email = $1;`

  const check_exist = await db.any(query2, [req.body.email])
  if (check_exist.length > 0){
    res.render('pages/login')
    return
  }
  /*db.one(query2)
  .then(function(){
    //res.redirect('/login');
    res.render("pages/register");
  })
  .catch(error => {*/
    //console.log('b')
    //console.log(error)
    
    db.any(query, [
      req.body.email,
      'default user',
      hash


    ])
    
    res.redirect("/login")

  //})
  

});

app.get("/register", (req, res) => {
    res.render("pages/register.ejs");
});

const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

app.use(auth);


//app.get('/kitchen', (req, res) => {
//  res.render("pages/kitchen.ejs");
//});

//app.get("/kitchen", (req, res) => {
  //res.render("pages/kitchen", { user_id: req.session.user.user_id });
  
//});

app.get("/kitchen", (req, res) => {
  const user_recipes = 'SELECT * FROM recipes WHERE user_id = $1'
  console.log('User ID:', req.session.user.user_id);

  // Query to list all the recipes created by a user
  db.any(user_recipes, [req.session.user.user_id])
    .then((recipes) => {
      // Render the 'kitchen' page with the 'recipes' array and 'user_id'
      res.render('pages/kitchen', { recipes, user_id: req.session.user.user_id });
    })
    .catch((err) => {
      res.render("pages/kitchen", {
        recipes: [],
        error: true,
        message: err.message,
      });
    });
});

app.post('/kitchen/create', async (req, res) => {
  try {
      const recipe_name = "test_recipe";
      const user_id = req.session.user.user_id;
      const is_starred = true;
      const { recipe_text } = req.body;

      // Insert the new recipe into the recipes table
      const newRecipe = await db.one('INSERT INTO recipes (recipe_text, recipe_name, user_id, is_starred) VALUES ($1, $2, $3, $4) RETURNING *', [recipe_text, recipe_name, user_id, is_starred]);
      console.log(recipe_name);
      return res.redirect("/kitchen");
  } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(500).json({
          success: false,
          message: 'Error creating recipe',
          error: error.message,
      });
  }
});


app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get("/api/posts_feed", (req, res) => { //placeholder api for posts 
  const p = {
    title: "Lorum Ipsum",
    author: "user1234",
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
  }
  res.status(200).json({post_feed: [p, p, p, p]});
})

const all_user_ingredients = 
  `SELECT DISTINCT *
  FROM users_to_ingredients u_to_i
  JOIN ingredients i ON u_to_i.ingredient_id=i.ingredient_id
  WHERE u_to_i.user_id=$1;`;

const all_unused_ingredients = 
  `SELECT *
  FROM ingredients i
  WHERE NOT EXISTS (
    SELECT 1
    FROM users_to_ingredients u_to_i
    WHERE u_to_i.ingredient_id = i.ingredient_id
    AND u_to_i.user_id = $1
  );`;

app.get('/pantry', async (req, res) => {
  var unused_ingredients = await db.any(all_unused_ingredients, [req.session.user.user_id]);
  db.any(all_user_ingredients, [req.session.user.user_id])
    .then((ingredients) => {
      console.log(ingredients);
      res.render("pages/pantry.ejs", {
        ingredients,
        unused_ingredients,
      });
    })
    .catch((err) => {
      res.render("pages/pantry.ejs", {
        ingredients: [],
        unused_ingredients: [],
        error: true,
        message: err.message,
      });
    });
});

app.post("/pantry/delete", async (req, res) => {
  const delete_query = `DELETE FROM
                          users_to_ingredients
                        WHERE
                          user_id = $1
                        AND 
                          ingredient_id = $2;`
  var updated_ingredients = await db.none(delete_query, [req.session.user.user_id, req.body.ingredient_id]);
  return res.redirect("/pantry");
});

app.post("/pantry/add", async (req, res) => {
  const add_query = `INSERT INTO
                        users_to_ingredients (user_id, ingredient_id)
                      VALUES
                        ($1, $2);`;
  var updated_ingredients = await db.none(add_query, [req.session.user.user_id, req.body.ingredient_id]);
  
  return res.redirect("/pantry"); });



app.get('/favorites', (req, res) => {
  res.render("pages/favorites.ejs");
});

app.get('/settings', (req, res) => {
  res.render("pages/settings.ejs");
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.render("pages/home.ejs");
});

app.listen(3000);
console.log("Server listening on port 3000"); 