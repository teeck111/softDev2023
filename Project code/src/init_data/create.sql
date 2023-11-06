

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

CREATE TABLE ingredients (
    user_id INT NOT NULL,
    ingredient VARCHAR(45)
);