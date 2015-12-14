# @cjsx React.DOM

React = require('react')

TabContent = React.createClass
  render: ->
    <div id="tab-content">
      {@props.tabs[@props.activeTabIdx].content}
    </div>

module.exports = TabContent