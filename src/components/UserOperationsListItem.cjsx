# @cjsx React.DOM

React = require('react')

UserOperationsListItem = React.createClass
  render: ->
    <div>
      User id: {@props.operationsData.user_id}<br/>
      Name: {@props.operationsData.name}
    </div>

module.exports = UserOperationsListItem