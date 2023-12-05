document.addEventListener('DOMContentLoaded', function () {
    var modals = document.querySelectorAll('.modal');

    modals.forEach(function (modal) {
      new bootstrap.Modal(modal);
    });
  });

  function saveRecipeChanges(recipeId) {
    // Get the values from the form
    var recipeName = document.getElementById('recipeName').value;
    var recipeText = document.getElementById('recipeText').value;
    var isStarred = document.getElementById('favoriteRecipe').checked;
  
    const requestData = {
      recipeName: recipeName,
      recipeText: recipeText,
      isStarred: isStarred,
    };

    console.log(recipeName);
    
    fetch(`/kitchen/update/${recipeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          
          console.log('Recipe updated successfully:', data);
        })
        .catch(error => {
          console.error('Error updating recipe:', error);
        });
    
    recipeModal.hide();
  }

  function fetchUserRecipes(recipeID) {
    fetch(`/kitchen/userRecipes`, {
        method: 'GET',
        body: recipeID,
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Recipes array returned', data);
            updateRecipeArray(data);

        })
        


    }


  