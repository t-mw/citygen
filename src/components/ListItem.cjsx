# @cjsx React.DOM

React = require('react')

ListItem = React.createClass
  render: ->
    <div>{this.props.value}</div>

module.exports = ListItem