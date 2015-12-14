# @cjsx React.DOM

React = require('react')

TabContent = require('./TabContent')
TabGroup = require('./TabGroup')
ListView = require('./ListView')

Tabs = React.createClass
  getInitialState: ->
    activeTabIdx: 0

  handleTabClick: (idx) ->
    @setState({activeTabIdx: idx})
    
  render: ->

    <div id="tab-wrapper" className="long-float">
      <TabGroup tabs={@props.tabs} onTabClick={@handleTabClick} />
      <TabContent tabs={@props.tabs} activeTabIdx={@state.activeTabIdx} />
    </div>

module.exports = Tabs