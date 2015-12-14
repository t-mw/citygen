# @cjsx React.DOM

React = require('react')

ListView = require('./ListView')
EditVehicleWindow = require('./EditVehicleWindow')
NewVehicleWindow = require('./NewVehicleWindow')
UserVehicleListItem = require('./UserVehicleListItem')

Constants = require('../dispatcher/Constants')
PlayerStore = require('../stores/PlayerStore')
VehicleStore = require('../stores/VehicleStore')

getStateFromStores = ->
  currentUserVehicles: VehicleStore.getByPlayerId(PlayerStore.getCurrentId())

UserVehicleListView = React.createClass
  getInitialState: ->
    getStateFromStores()

  componentDidMount: ->
    PlayerStore.addChangeListener(@_onChange)
    VehicleStore.addChangeListener(@_onChange)

  componentWillUnmount: ->
    PlayerStore.removeChangeListener(@_onChange)
    VehicleStore.removeChangeListener(@_onChange)

  render: ->
    <ListView items={
      _this = @
      _.map(@state.currentUserVehicles, (vehicleData) ->
          <UserVehicleListItem onVehicleEdit={@_onVehicleEdit} vehicleId={vehicleData.id} />
        , @).concat(<button onClick={@_onNewVehicleButton}>New</button>)
      } />

  _onNewVehicleButton: ->
    @props.setOverlayData({mode: Constants.OverlayModes.NEW_VEHICLE})

  _onVehicleEdit: (vehicleId) ->
    @props.setOverlayData({mode: Constants.OverlayModes.EDIT_VEHICLE, vehicleId: vehicleId})

  _onChange: ->
    @setState(getStateFromStores())

module.exports = UserVehicleListView
