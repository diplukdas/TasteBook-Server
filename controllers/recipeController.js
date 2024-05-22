const Recipe = require("../models/recipeModel");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");

const getAllRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find()
      .sort({ createdAt: -1 })
      .populate("author", "name");
    res.status(200).send(recipes);
  } catch (error) {
    next(error);
  }
};

const getRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id })
      .populate("author", "name")
      .populate("comments.user", ["name", "profilePicture"]);

    if (!recipe) return res.status(404).json({ message: "Recipe not found" });

    res.status(200).send(recipe);
  } catch (error) {
    next(error);
  }
};

const addRecipe = async (req, res, next) => {
  try {
    const {
      title,
      image,
      description,
      cookingTime,
      ingredients,
      instructions,
      category, // Added category field
    } = req.body;

    // Ensure all required fields are provided
    if (
      !title ||
      !image ||
      !description ||
      !cookingTime ||
      !ingredients.length ||
      !instructions.length ||
      !category // Ensure category is provided
    ) {
      return res.status(422).json({ message: "Insufficient data" });
    }

    const recipe = new Recipe({ // Create a new Recipe instance with category
      title,
      image,
      description,
      cookingTime,
      ingredients,
      instructions,
      category,
      author: req.user,
    });

    await recipe.save();
    res.status(201).json({ success: "Recipe added successfully" });
  } catch (error) {
    next(error);
  }
};

const updateRecipe = async (req, res, next) => {
  try {
    const {
      title,
      image,
      description,
      cookingTime,
      ingredients,
      instructions,
      category,
    } = req.body;
    
    // Check if all required fields are provided
    if (!title || !image || !description || !cookingTime || !ingredients.length || !instructions.length || !category) {
      return res.status(422).json({ message: "Insufficient data" });
    }

    const foundRecipe = await Recipe.findById(req.params.id);
    if (!foundRecipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    // Ensure only the author can update the recipe
    if (foundRecipe.author.toString() !== req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Update recipe fields
    foundRecipe.title = title;
    foundRecipe.description = description;
    foundRecipe.image = image;
    foundRecipe.ingredients = ingredients;
    foundRecipe.cookingTime = cookingTime;
    foundRecipe.instructions = instructions;
    foundRecipe.category = category;

    // Save the updated recipe
    const updatedRecipe = await foundRecipe.save();
    res.status(200).json(updatedRecipe); // Changed status code to 200 for successful update
  } catch (error) {
    next(error);
  }
};


const rateRecipe = async (req, res, next) => {
  try {
    const { rating } = req.body;

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found." });
    }

    // Check if the user has already rated this recipe
    const existingRating = recipe.ratings.find((rate) =>
      rate.user.equals(req.user)
    );
    if (existingRating) {
      return res
        .status(400)
        .json({ message: "User has already rated this recipe" });
    }

    // Add the new rating
    recipe.ratings.push({ user: req.user, rating: rating });
    await recipe.save();

    res.status(201).json({ message: "Rating added successfully." });
  } catch (error) {
    next(error);
  }
};

const deleteRecipe = async (req, res, next) => {
  try {
   
    const foundRecipe = await Recipe.findById(req.params.id);
    if (!foundRecipe) {
      return res.status(404).json({ message: "Recipe not found" });
    }

    // Find the user by ID
    const user = await User.findById(req.user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user is an admin
    const isAdmin = user.roles.includes('Admin');
    
    // Check if the user is the author of the recipe
    const isAuthor = foundRecipe.author.equals(req.user._id); // Using equals to compare ObjectIds

    // Authorization check
    if (!isAdmin && !isAuthor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Delete the recipe
    await foundRecipe.deleteOne({ _id: req.params.id });

    // Send success status
    res.sendStatus(204);
  } catch (error) {
    // Pass the error to the next middleware
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { comment } = req.body;

    // Validate userId and commentText
    if (!comment) {
      return res.status(400).json({ message: "Comment is required." });
    }

    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found." });
    }

    // Add the new comment
    recipe.comments.push({ user: req.user, comment });
    await recipe.save();

    res.status(201).json({ message: "Comment added successfully." });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const { recipeId, commentId } = req.params;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ message: "Recipe not found." });
    }

    const commentIndex = recipe.comments.findIndex((comment) =>
      comment._id.equals(commentId)
    );
    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found." });
    }

    recipe.comments.splice(commentIndex, 1);
    await recipe.save();

    res.status(200).json({ message: "Comment deleted successfully." });
  } catch (error) {
    next(error);
  }
};

const toggleFavoriteRecipe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const recipeIndex = user.favorites.indexOf(req.params.id);
    if (recipeIndex === -1) {
      // Recipe not present, add it to favorites
      user.favorites.push(req.params.id);
    } else {
      // Recipe already present, remove it from favorites
      user.favorites.splice(recipeIndex, 1);
    }

    await user.save();

    const roles = Object.values(user.roles);

    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: user._id,
          name: user.name,
          email: user.email,
          profilePicture: user.profilePicture,
          roles: roles,
          favorites: user.favorites,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1d" }
    );
    return res.status(201).json({ accessToken });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRecipes,
  getRecipe,
  addRecipe,
  updateRecipe,
  rateRecipe,
  deleteRecipe,
  addComment,
  deleteComment,
  toggleFavoriteRecipe,
};
