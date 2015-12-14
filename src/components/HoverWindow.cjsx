# @cjsx React.DOM

React = require('react')

HoverWindow = React.createClass
  render: ->
    <div id="hover-window-container">
      <div id="hover-window-filler"></div>
      <div id="hover-window">
        <div className="title">
          {if @props.title? then @props.title else "Untitled"}
          {if @props.onClose? then <span className="close-button"><a href="#" onClick={@props.onClose}>X</a></span>}
        </div>
        <div className="content">
          {@props.contents}
        </div>
      </div>
    </div>

module.exports = HoverWindow