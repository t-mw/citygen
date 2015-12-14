# @cjsx React.DOM

React = require('react')

ListItem = require('./ListItem')

ListView = React.createClass
  render: ->
    items = []

    for item in @props.items
      items.push(<ListItem value={item} />)
    
    <div className="list-view">
      {items}
    </div>

module.exports = ListView