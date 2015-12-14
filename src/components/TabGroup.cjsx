# @cjsx React.DOM

React = require('react')
_ = require('lodash')

TabGroup = React.createClass
  onClick: (tabIdx) ->
    @props.onTabClick(tabIdx)

  render: ->
    tabButtons = _.map(@props.tabs, (tab, i) ->
      <button onClick={_.bind(@onClick, null, i)}>{tab.title}</button>  
    , this)

    <div id="tab-group">
      {tabButtons}
    </div>

module.exports = TabGroup