var Dispatcher = require('./Dispatcher');
var copyProperties = require('react/lib/copyProperties');
var Constants = require('../dispatcher/Constants')

var AppDispatcher = copyProperties(new Dispatcher(), {

  /**
   * A bridge function between the views and the dispatcher, marking the action
   * as a view action.  Another variant here could be handleServerAction.
   * @param  {object} action The data coming from the view.
   */
  handleViewAction: function(action) {
    this.dispatch({
      source: Constants.PayloadSources.ViewAction,
      action: action
    });
  },

  handleLogicAction: function(action) {
    this.dispatch({
      source: Constants.PayloadSources.LogicAction,
      action: action
    });
  }

});


module.exports = AppDispatcher;
