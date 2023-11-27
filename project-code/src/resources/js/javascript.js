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
  
    const requestData = {
      recipeName: recipeName,
      recipeText: recipeText,
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
    
    var modalId = 'recipeModal' + recipeId;
    var recipeModal = new bootstrap.Modal(document.getElementById(modalId));
    recipeModal.hide();
  }

  