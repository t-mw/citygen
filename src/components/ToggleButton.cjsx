# @cjsx React.DOM

React = require('react')

ToggleButton = React.createClass
  getInitialState: ->
    textValue: @props.offText
    toggleState: false

  render: ->
    <button onClick=@_onButtonClick>{@state.textValue}</button>

  _onButtonClick: ->
    newToggleState = !@state.toggleState
    @setState({
      toggleState: newToggleState
      textValue: if newToggleState then @props.onText else @props.offText
    })
    @props.action()

module.exports = ToggleButton