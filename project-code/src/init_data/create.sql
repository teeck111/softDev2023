

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email varchar(255) NOT NULL,
    username varchar(45) NOT NULL,
    password varchar(255) NOT NULL
);

CREATE TABLE recipes (
    recipe_id SERIAL PRIMARY KEY,
    recipe_text TEXT NOT NULL,
    creator_id INT,

    CONSTRAINT fk_creator
        FOREIGN KEY(creator_id)
            REFERENCES users(user_id)
);

CREATE TABLE ingredients (
    ingredient_id SERIAL PRIMARY KEY,
    ingredient_text VARCHAR(45) NOT NULL
);

CREATE TABLE users_to_ingredients (
    user_id INT,
    ingredient_id INT,

    CONSTRAINT fk_user_id
        FOREIGN KEY(user_id)
            REFERENCES users(user_id),
    CONSTRAINT fk_ingredient_id
        FOREIGN KEY(ingredient_id)
            REFERENCES ingredients(ingredient_id)
);