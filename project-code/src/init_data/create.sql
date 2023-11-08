

CREATE TABLE users (
    user_id INT PRIMARY KEY SERIAL,
    email varchar(255) NOT NULL,
    username varchar(45) NOT NULL,
);

CREATE TABLE recipes (
    recipe_id INT PRIMARY KEY SERIAL,
    recipe_text TEXT NOT NULL,
    creator_id INT,

    CONSTRAINT fk_creator
        FOREIGN KEY(creator_id)
            REFERENCES users(user_id)
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

CREATE TABLE ingredients (
    ingredient_id INT PRIMARY KEY SERIAL,
    ingredient_text VARCHAR(45) NOT NULL
);