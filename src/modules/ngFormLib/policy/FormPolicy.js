import angular from 'angular';

// The form policy intentionally has no hard dependencies.
// If there are form-policy values that exist when the service is being constructed, it will use them.
// Otherwise it will use no-op policy functions.
const mod = angular.module('ngFormLib.policy', []);

export default mod.name;


// This is a configurable service
// It should contain the _default_ values for form policies

mod.provider('formPolicyService', function() {
  let self = this;
  let noop = () => {};
  let nullBehaviourOnStateChange = {
    behaviour: () => {
      return {
        applyBehaviour: noop,
        resetBehaviour: noop
      }
    }
  };
  let nullStateDefinitions = {
    create: () => { return {}; },
    states: () => { return {}; }
  };
  let nullAccessibilityBehaviour = {
    createAriaErrorElement: () => '',
    onErrorChangeBehaviour: noop
  };

  // The self.defaults property allows the formPolicy to be customised for a specific form
  self.defaults = {
    formSubmitAttemptedClass: 'form-submit-attempted',
    accessibilityBehaviour: null,
    behaviourOnStateChange: null,
    checkForStateChanges: null,
    stateDefinitions: null
  };

  this.$get = ['$injector', function($injector) {

    function getService(name) {
      try {
        return $injector.get(name);
      } catch (e) {
        return null;    // Provider-not-found error, ignore and move on
      }
    }

    // Policy precedence: this.defaults, policy-value-object, noop
    self.defaults.accessibilityBehaviour = self.defaults.accessibilityBehaviour || getService('formPolicyAccessibilityBehaviour') || nullAccessibilityBehaviour;
    self.defaults.behaviourOnStateChange = self.defaults.behaviourOnStateChange || getService('formPolicyBehaviourOnStateChange') || nullBehaviourOnStateChange;
    self.defaults.checkForStateChanges = self.defaults.checkForStateChanges || (getService('formPolicyCheckForStateChanges') || {}).checker || noop;
    self.defaults.stateDefinitions = self.defaults.stateDefinitions || getService('formPolicyStateDefinitions') || nullStateDefinitions;

    var policyService = {
      getCurrentPolicy: function() {
        return angular.copy(self.defaults);
      }
    };

    return policyService;
  }];
});


function formDirective(formPolicyService) {

  return {
    //priority: -1,
    restrict: 'AE',
    require: ['?form'], // Tells the directive to get the controller for the 'form' directive, which is the FormController controller
    compile: function(tElement, tAttr) {

      // Use element.data() to store a reference to this element for use by child.inheritedData()
      // Will storing an element this way cause a memory leak? Or should I just store the data I currently need (attr.class)
      // This has to happen during the compile step, as the children need access to the variable when they are compiled
      //  ('class' is a reserved word to JavaScript, so we need to treat it as a string)
      tElement.data('formElementClasses', tAttr['class']);  //jscs:ignore

      return {
        pre: function(scope, element, attr, controller) {
          // We want to extend the FormController by adding a form policy
          var formController = controller[0];
          formController._policy = angular.extend(formPolicyService.getCurrentPolicy(), scope.$eval(attr.formPolicy));

          // Add a reference to the <form> element's scope to the formController, to support showing errors for nested components
          formController._scope = scope;

          // Determine if we have a parent form controller. If we do, we want to use it for the focus behaviour
          formController._parentController = element.parent().controller('form');

          if (!formController._parentController) {
            // We also want to add an element reference when a control is added
            formController._controls = {};
          }

          // Generate the focus policy function for use by other directive
          formController._applyFormBehaviourOnStateChangePolicy = formController._policy.behaviourOnStateChange.behaviour(formController);

          // Add/remove a class onto the form based on the value of the formSubmitted variable
          formController.setSubmitted = function(value, tellNoOne) {
            element[value ? 'addClass' : 'removeClass'](formController._policy.formSubmitAttemptedClass);
            formController._formSubmitAttempted = value;
            formController._applyFormBehaviourOnStateChangePolicy.resetBehaviour();

            if (value && !tellNoOne) {
              scope.$broadcast('event:FormSubmitAttempted');
            }
          };

          // Flag to indicate whether the form has been submitted
          formController._formSubmitAttempted = false;
          formController._applyFormBehaviourOnStateChangePolicy.resetBehaviour();

          // If this form is an ngForm (in that it has a parent 'form'), then we need to make sure that
          // when the parent form is submitted or reset, the same thing happens to the child forms
          if (formController._parentController) {
            scope.$watch(function() { return formController._parentController._formSubmitAttempted; }, function(value) {
              if (value !== undefined) {
                //formController.setSubmitted(!!value, true);  // Don't send another notification, just update our own state
                formController.setSubmitted(!!value);  // Don't send another notification, just update our own state
              }
            });
          }
        }
      };
    }
  };
}
mod.directive('form', ['formPolicyService', formDirective]);
mod.directive('ngForm', ['formPolicyService', formDirective]);


// We want our formController to expose the list of controls that are registered with the form,
// including controls inside sub-forms. That allows us to reset them directly. Relying simply on the fieldName
// does not work when using sub-forms inside ng-repeaters.

var inputElements = ['input', 'select'];

angular.forEach(inputElements, function(inputElem) {
  mod.directive(inputElem, function() {

    function hookupElementToNameToElementMap(formController, element, fieldName, fieldController) {
      // Each element in the map is an array, because form elements *can have the same name*!
      var map = formController._controls;
      if (!map[fieldName]) {
        map[fieldName] = [];
      }
      // Add the field to the end of the list of items with the same name
      map[fieldName][map[fieldName].length] = {'element': element, 'controller': fieldController};


      element.on('$destroy', function() {
        // Delete just this element from the map of controls
        var map = formController._controls[element.attr('name')];
        var elementId = element.attr('id');
        for (var i = 0; i < map.length; i++) {
          if (map[i].element.attr('id') === elementId) {
            map.splice(i, 1);
            break;
          }
        }
      });
    }

    return {
      restrict: 'E',
      require: ['?^form', '?ngModel'],
      link: {
        pre: function(scope, element, attr, controllers) {
          if (!controllers[0]) {
            return;
          }

          var rootFormController = controllers[0]._parentController || controllers[0],
              fieldController = controllers[1],
              name = attr.name;

          if (rootFormController && rootFormController._controls) {
            hookupElementToNameToElementMap(rootFormController, element, name, fieldController);
          }
        }
      }
    };
  });
});

