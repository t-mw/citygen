# @cjsx React.DOM

_ = require('lodash')
React = require('react')

GameCanvas = require('./GameCanvas')
HoverWindow = require('./HoverWindow')
ListItem = require('./ListItem')
ListView = require('./ListView')
Tabs = require('./Tabs')
UserOperationsListItem = require('./UserOperationsListItem')
UserVehicleListView = require('./UserVehicleListView')
ViewportOverlay = require('./ViewportOverlay')

Constants = require('../dispatcher/Constants')

GameApp = React.createClass
  getInitialState: ->
    overlayData: undefined

  render: ->
    <div>
      <div id="main-viewport-container">
        <div id="main-viewport">
          <GameCanvas setOverlayData={@_setOverlayData} overlayData={@state.overlayData} />
          <div id="viewport-overlay">
            <ViewportOverlay setOverlayData={@_setOverlayData} overlayData={@state.overlayData} />
          </div>
        </div>
      </div>
      <div id="control-bar">
        <div id="mini-map" className="square-float"></div>
        <Tabs
          tabs={[
            {
              title: "Vehicles"
              content:
                <UserVehicleListView setOverlayData={@_setOverlayData} />
            },{
              title: "Operations"
              content:
                <ListView items={
                  operations = @props.gameData.getOperations()
                  _.map(operations, (operations_data) ->
                      <UserOperationsListItem operationsData={operations_data} />
                    , @)
                } />
            }
            ]}
        />
      </div>
    </div>

  _setOverlayData: (data) ->
    @setState({overlayData: data})

module.exports = GameApp
