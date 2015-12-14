# @cjsx React.DOM

_ = require('lodash')
React = require('react')

RouteActions = require('../actions/RouteActions')
RouteStore = require('../stores/RouteStore')
VehicleStore = require('../stores/VehicleStore')
VehicleTypeStore = require('../stores/VehicleTypeStore')

getStateFromStores = ->
  routePartialByVehicleId: RouteStore.getByVehicleId
  vehicleDataById: VehicleStore.get
  vehicleTypes: VehicleTypeStore.getAll()

UserVehicleListItem = React.createClass
  getInitialState: ->
    getStateFromStores()

  componentDidMount: ->
    RouteStore.addChangeListener(@_onChange)
    VehicleStore.addChangeListener(@_onChange)
    VehicleTypeStore.addChangeListener(@_onChange)

  componentWillUnmount: ->
    RouteStore.removeChangeListener(@_onChange)
    VehicleStore.removeChangeListener(@_onChange)
    VehicleTypeStore.removeChangeListener(@_onChange)

  render: ->
    vehicleData = @state.vehicleDataById(@props.vehicleId)
    routePartials = @state.routePartialByVehicleId(@props.vehicleId)

    cargoText = ("#{cargo.resourceType}(#{cargo.level})" for cargo in vehicleData.cargo).join(" ")

    <div>
      Type: {@state.vehicleTypes[vehicleData.type_id].type}<br/>
      Route length: {routePartials.length()}<br/>
      Cargo: {cargoText}
      <button onClick={_.bind(@props.onVehicleEdit, null, @props.vehicleId)}>Edit</button>
      <input type="checkbox" onChange={_.bind(@_onActiveCheck, null, @props.vehicleId)} />Active
    </div>

  _onChange: ->
    @setState(getStateFromStores())

  _onActiveCheck: (vehicle_id, e) ->
    RouteActions.setActive(vehicle_id, e.target.checked)

module.exports = UserVehicleListItem