const express = require("express");
const app = express();
const pgp = require("pg-promise")();
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Creating the bedrock service object
const bedrock = new AWS.BedrockRuntime();

app.use(bodyParser.json());


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

app.get("/", async (req, res) => {
  const posts = [];

  const posts_sql = `SELECT recipe_text, recipe_name, U.username, R.recipe_id FROM recipes R
    JOIN users U ON R.user_id = U.user_id
    WHERE R.is_posted = TRUE
    ORDER BY R.recipe_id DESC
    LIMIT 15
  `

  const recipes = await db.manyOrNone(posts_sql);
  for (let i = 0; i < recipes.length; i++){
    const recipe = recipes[i];
    const likes = await db.manyOrNone("SELECT * FROM users_to_likes WHERE recipe_id = $1", [recipe.recipe_id]);

    var user_has_liked = false;
    if (req.session.user != undefined && req.session.user_id != undefined){
      for (let j = 0; j < likes.length; j++){
        if (likes[j].user_id == req.session.user.user_id){
          user_has_liked = true;
          break;
        }
      }
    }

    posts.push({
      title: recipe.recipe_name,
      author: recipe.username,
      content: recipe.recipe_text,
      likes: likes.length,
      user_has_liked
    })
  }

  console.log(posts);

  res.render("pages/home.ejs", {session: req.session.user, posts});
});

app.get("/login", (req, res) => {
    res.render("pages/login.ejs",{session: req.session.user});
});


app.post("/login", async (req, res) => {
  if (req.body.username == undefined || req.body.password == undefined || req.body.username.length == 0 || req.body.password.length == 0){
      res.render("pages/login", {session: req.session.user, message: "Please enter a username and password.", error: true});
      return true;
  }

  var user_sql = "SELECT user_id, email, username, d_restric, password FROM users WHERE username = $1";
  var username = req.body.username;
  if (/^.+@.+\..+$/.test(req.body.username)) { //log in with email
    user_sql = "SELECT user_id, email, username, d_restric, password FROM users WHERE email = $1";
    username = username.toLowerCase();
  }

  var user = null;

  try {
    user = await db.any(user_sql, [username]);
    if (user.length == 0){
        res.status(400);
        res.render("pages/login", {session: req.session.user, message: "Incorrect username or password.", error: true});
        return true;
    }
  }
  catch(ex) {
    res.status(400);
    res.render("pages/login", {session: req.session.user, message: "An internal error occured.", error: true});
    console.error(ex);
    return true;
  }

  const match = await bcrypt.compare(req.body.password, user[0].password);

  if (match){
      req.session.user = { //the session object - use this to get user_id, username, etc.
        user_id: user[0].user_id,
        username: user[0].username,
        email: user[0].email,
        d_restric: user[0].d_restric
      };
      req.session.save();
      res.status(200);
      res.redirect('/kitchen');

    } else {
      res.status(400);
      res.render("pages/login", {session: req.session.user, message: "Incorrect username or password.", error: true});
  }
});

app.post("/register", async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  const query = 'INSERT INTO users(email, username, password) VALUES ($1,$2,$3)';
  console.log(req.body.email)
  const query2 = `SELECT * FROM users WHERE email = $1;`

  const check_exist = await db.any(query2, [req.body.email])
  if (check_exist.length > 0){
    res.render('pages/login', {session: req.session.user})
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
    res.render("pages/register.ejs",{session: req.session.user});
});

const auth = (req, res, next) => { //Authentication Middleware
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

  if (!req.session.user.user_id){
    res.status(406).json({message: "Missing user_id in session cookie!", session: req.session});
    return;
  }

  const user_recipes = 'SELECT * FROM recipes WHERE user_id = $1 ORDER BY recipe_id DESC LIMIT 10'

  db.any(user_recipes, [req.session.user.user_id])
    .then((recipes) => {
      // Render the 'kitchen' page with the 'recipes' array and 'user_id'
      console.log('User ID:', req.session.user.user_id);
      res.render('pages/kitchen', { recipes, session: req.session.user, user_id: req.session.user.user_id, display_recipe_index: req.query.recipe_index, bedrockreturn: null, restrictionChoice: 'restricted' });

    })
    .catch((err) => {
      res.render("pages/kitchen", {
        recipes: [],
        restrictionChoice: 'restricted',
        error: true,
        message: err.message,
        session: req.session.user,
        display_recipe_index: null
      });
    });
});


//This post call is responsible for the following:
//Collecting ingredients if specified by user
//Promting claude withe user promt and ingredients(if specified)
//Updating the kitchen page with the generated recipe




app.put('/kitchen/update/:recipeId', async (req, res) => {
  const recipeId = req.params.recipeId;
  const { recipeName, recipeText, isStarred } = req.body;

  try {
    const updateQuery = 'UPDATE recipes SET recipe_name = $1, recipe_text = $2, is_starred = $3 WHERE recipe_id = $4 RETURNING *';
    console.log(recipeName);
    const updatedRecipe = await db.one(updateQuery, [recipeName, recipeText, isStarred, recipeId]);

  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/kitchen/delete/:recipeId', async (req, res) => {
  const recipeId = req.params.recipeId;
  console.log('Kitchen Delete');
  console.log('Recipe ID', recipeId);

  try {
    deleteQuery = `DELETE FROM recipes WHERE recipe_id = $1`;
    await db.none(deleteQuery, [recipeId]);
    res.redirect('/kitchen');

  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
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
  WHERE u_to_i.user_id=$1
  ORDER BY i.ingredient_text ASC;`;

const all_unused_ingredients = 
  `SELECT *
  FROM ingredients i
  WHERE NOT EXISTS (
    SELECT 1
    FROM users_to_ingredients u_to_i
    WHERE u_to_i.ingredient_id = i.ingredient_id
    AND u_to_i.user_id = $1
  )
  ORDER BY i.ingredient_text ASC;`;

app.get('/pantry', async (req, res) => {
  var searchbar_val = '';
  var unused_ingredients = await db.any(all_unused_ingredients, [req.session.user.user_id]);
  db.any(all_user_ingredients, [req.session.user.user_id])
    .then((ingredients) => {
      res.render("pages/pantry.ejs", {
        ingredients,
        unused_ingredients,
        searchbar_val,
        session: req.session.user
      });
    })
    .catch((err) => {
      res.render("pages/pantry.ejs", {
        ingredients: [],
        unused_ingredients: [],
        searchbar_val,
        error: true,
        message: err.message,
        session: req.session.user
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
  return res.redirect("/pantry");

});

app.post('/pantry/search', async (req, res) => {
  var search_ingredients = 
  `SELECT *
  FROM ingredients i
  WHERE NOT EXISTS (
    SELECT 1
    FROM users_to_ingredients u_to_i
    WHERE u_to_i.ingredient_id = i.ingredient_id
    AND u_to_i.user_id = $1
  )
  AND LOWER(i.ingredient_text) LIKE LOWER('${req.body.search_val}%')
  ORDER BY i.ingredient_text ASC;`;
  var searchbar_val = req.body.search_val;
  var unused_ingredients = await db.any(search_ingredients, [req.session.user.user_id]);
  db.any(all_user_ingredients, [req.session.user.user_id])
    .then((ingredients) => {
      res.render("pages/pantry.ejs", {
        ingredients,
        unused_ingredients,
        searchbar_val,
        session: req.session.user
      });
    })
    .catch((err) => {
      res.render("pages/pantry.ejs", {
        ingredients: [],
        unused_ingredients: [],
        searchbar_val,
        error: true,
        message: err.message,
        session: req.session.user
      });
    });
});

app.post("/api/like", async (req, res) => {
  var like_query = `INSERT INTO users_to_likes (user_id, recipe_id)
                    VALUES ($1, $2)
                    WHERE NOT EXISTS (
                      SELECT 1 FROM recipe_likes
                      WHERE recipe_id = $2 
                      AND user_id = $1
                    );`;
  var updated_likes = await db.none(like_query, [req.session.user.user_id, req.body.recipe_id]);
});
app.post("/api/unlike", async (req, res) => {

}); //todo

app.post('/pantry/search', async (req, res) => {
  var search_ingredients = 
  `SELECT *
  FROM ingredients i
  WHERE NOT EXISTS (
    SELECT 1
    FROM users_to_ingredients u_to_i
    WHERE u_to_i.ingredient_id = i.ingredient_id
    AND u_to_i.user_id = $1
  )
  AND LOWER(i.ingredient_text) LIKE LOWER('${req.body.search_val}%')
  ORDER BY i.ingredient_text ASC;`;
  var unused_ingredients = await db.any(search_ingredients, [req.session.user.user_id]);
  db.any(all_user_ingredients, [req.session.user.user_id])
    .then((ingredients) => {
      res.render("pages/pantry.ejs", {
        ingredients,
        unused_ingredients,
        session: req.session.user
      });
    })
    .catch((err) => {
      res.render("pages/pantry.ejs", {
        ingredients: [],
        unused_ingredients: [],
        error: true,
        message: err.message,
        session: req.session.user
      });
    });
});

app.get('/settings', async (req, res) => {
  const user_id = req.session.user.user_id;
  let message = null;
  message = req.query.msg; 
  try {
    const query1 = 'SELECT username FROM users WHERE user_id = $1';
    const query2 = 'SELECT d_restric FROM users WHERE user_id = $1';

    const data = await db.task('get-everything', async task => {
      const result1 = await task.one(query1, user_id);
      const result2 = await task.one(query2, user_id);
      return [result1, result2];
    });

    const username = data[0].username;
    const dietaryRestrictions = data[1].d_restric;

    res.render('pages/settings.ejs', {
      currentUsername: username,
      currentDietaryRestrictions: dietaryRestrictions,
      session: req.session.user,
      message: message 
    });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(400).send('Error fetching data');
  }

});

app.get("/favorites", async (req, res) => {
  db.any("SELECT * FROM recipes WHERE user_id = $1 AND is_starred = TRUE", [req.session.user.user_id])
    .then((recipes) => {
      res.render('pages/favorites', { recipes, session: req.session.user, user_id: req.session.user.user_id,});
      // Render the 'favorites' page with the 'recipes' array and 'user_id'
      console.log('User ID:', req.session.user.user_id);

    })

    .catch((err) => {
      res.render('pages/favorites', { recipes:[], session: req.session.user, user_id: req.session.user.user_id, display_recipe_index: req.query.recipe_index });
      console.log(err);
      });
});

app.post('/kitchen/create', async (req, res) => {
  const prompt = req.body.prompt; 
  const user_id = req.session.user.user_id; 
  // TODO: Figure out how to get if it's started
  const is_starred = false;
  const restrictionChoice = req.body.isRestricted;
  const restricted = restrictionChoice === 'restricted';
  let query;
  
  const dietaryRestrictions = await db.one(' SELECT users.d_restric FROM users WHERE users.user_id = $1 ', [user_id]);
  // if isRestricted then use the ingredients 
  if(restricted === true)
  {
    try{
    const ingredients = await db.any('SELECT ingredients.ingredient_text FROM ingredients INNER JOIN users_to_ingredients ON ingredients.ingredient_id = users_to_ingredients.ingredient_id WHERE users_to_ingredients.user_id = $1', [user_id]);
    ingredients.forEach(ingredient => {
      console.log(ingredient.ingredient_text);
    });

    const ingredientTexts = ingredients.map(ingredient => ingredient.ingredient_text).join(", ");
    console.log("Comma-separated ingredients: " + ingredientTexts);

    query = `\n\nHuman: 
    Generate a recipe that aligns with the user's input and ingredient preferences. User's input: "${prompt}". 
    The recipe must only utilize ingredients from the following list. Do not return a recipe that uses ingredients that are not present in the list.
    If there are not enough ingredients in the list then return "Not enough ingredients". Ingredient list: ${ingredientTexts}.
    The recipe must also comply with the following dietary restrictions: ${dietaryRestrictions.d_restric}.
    Output should include only the recipe instructions and ingredients. Don't add an introductory statement like " Here is a pasta recipe:"
    \n\nAssistant:
    `;

    } catch(error){
      console.error("Error:", error);
      return res.status(407).json({ message: "Error querying ingredients", error: error });
    };
  }else{
    // restricted is not selected so we won't need to use ingredients
    query = `\n\nHuman: 
    Generate a recipe based on the user's input: "${prompt}".
    Output must include only the recipe instructions and ingredients. Don't add an introductory statement like " Here is a pasta recipe:"
    The recipe must also comply with the following dietary restrictions: ${dietaryRestrictions.d_restric}.

    \n\nAssistant:
    `
  }
  try {
    const params = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: query,
        max_tokens_to_sample: 4000,
        temperature: 0.5,
        top_k: 250,
        top_p: 1,
        stop_sequences: [
          "\n\nHuman:"
        ],
        anthropic_version: "bedrock-2023-05-31"
      })
    };

  const bedrockReturn = await bedrock.invokeModel(params).promise();
  
  const buffer = Buffer.from(bedrockReturn.body);

    // Convert the buffer to a string
  const responseString = buffer.toString('utf-8');
  const responseJSON = JSON.parse(responseString);
  const recipe_text = responseJSON.completion;

  // TODO console log the result to determine how to access specific data in JSON the below text and name may be collected incorectly
  

  const query1 = `\n\nHuman: 
  Generate a recipe name based on this recipe: "${recipe_text}".
  Only response with a recipe name. Don't add an introductory statement like "Here is a generated recipe name based on the ingredients and instructions:"
  \n\nAssistant:
  `
  // give the recipe a name
  const nameParams = {
    modelId: "anthropic.claude-instant-v1",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      prompt: query1,
      max_tokens_to_sample: 1000,
      temperature: 0.5,
      top_k: 250,
      top_p: 1,
      stop_sequences: [
        "\n\nHuman:"
      ],
      anthropic_version: "bedrock-2023-05-31"
    })
  };

  const bedrockReturn1 = await bedrock.invokeModel(nameParams).promise();
  const buffer1 = Buffer.from(bedrockReturn1.body);

  // Convert the buffer to a string
  const responseString1 = buffer1.toString('utf-8');
  const responseJSON1 = JSON.parse(responseString1);
  const recipe_name = responseJSON1.completion;

  // Insert the new recipe into the recipes table
  await db.one('INSERT INTO recipes (recipe_text, recipe_name, user_id, is_starred) VALUES ($1, $2, $3, $4) RETURNING *', [recipe_text, recipe_name, user_id, is_starred]);
  
  const bedrockreturn = {
    recipeName: recipe_name,
    recipeDetails: recipe_text
  };

  // Render the kitchen page with the Bedrock API response data
  const recipes = await db.any("SELECT * FROM recipes WHERE user_id = $1 ORDER BY recipe_id DESC LIMIT 10", [user_id])
  res.render("pages/kitchen", { recipes, bedrockreturn: bedrockreturn, session: req.session.user, user_id: user_id, restrictionChoice: restrictionChoice});
  return;
  } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(408).json({
          success: false,
          message: 'Error creating recipe',
          error: error.message,
      });
  }
});


app.post('/settings', async (req, res) => {
  const newUsername = req.body.username;
  const restric = req.body.d_res;
  const userId = req.session.user.user_id
  if ((!newUsername || newUsername.trim() === '') && (!restric || restric.trim() === '')) {
    return res.redirect('/settings?msg=No empty usernames');
  }
  if ((!newUsername || newUsername.trim() === '')) {
    return res.redirect('/settings?msg=No empty usernames');
  }

  if (newUsername.includes(' ')) {
    return res.redirect('/settings?msg=Username cannot contain spaces');
  } 

  getCurrentUsername = 'SELECT username from users where user_id = $1'
  const currentUsernameResult = await db.one(getCurrentUsername, [userId]);
  const currentUsername = currentUsernameResult.username;

  try {
    if(currentUsername != newUsername){
      const checkQuery = "SELECT * FROM users WHERE username = $1";
      const check = await db.oneOrNone(checkQuery, [newUsername]);
      if (check) {
        return res.redirect('/settings?msg=Username already exists');
      }
    }
    let updateQuery;
    let queryParameters;

    if (!restric || restric.trim() === '') {
      updateQuery = `UPDATE users SET username = $1, d_restric = NULL WHERE user_id = $2 RETURNING username, d_restric`;
      queryParameters = [newUsername, userId];
    } else {
      updateQuery = `UPDATE users SET username = $1, d_restric = $2 WHERE user_id = $3 RETURNING username, d_restric`;
      queryParameters = [newUsername, restric, userId];
    }
    
    const updateResult = await db.one(updateQuery, queryParameters);
    
    res.render('pages/settings.ejs', {
      currentUsername: updateResult.username || newUsername || currentUsername,
      currentDietaryRestrictions: updateResult.d_restric || '',
      session: req.session.user,
      message: "Settings updated successfully"
    });

    // return res.redirect('/settings');
  } catch (error) {
    console.log('Error:', error);
    return res.status(400).json({ error: error.message });
  }
});


app.post('/kitchen/update/:recipeId', async (req, res) => {

      const recipeId = req.params.recipeId;
      const { recipeName, recipeText, isStarred } = req.body;
      stared = (isStarred === 'on' ? true : false);
      try {
          const updateQuery = 'UPDATE recipes SET recipe_name = $1, recipe_text = $2, is_starred = $3 WHERE recipe_id = $4 RETURNING *';
          await db.one(updateQuery, [recipeName, recipeText, stared, recipeId]);
          res.redirect('/kitchen'); 
      } catch (error) {
          console.error('Error updating recipe:', error);
          res.status(500).send('Internal server error');
      }
});



app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/")
});

app.listen(3000);
console.log("Server listening on port 3000"); 