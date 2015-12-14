# @cjsx React.DOM

React = require('react')

EditVehicleWindow = require('./EditVehicleWindow')
NewVehicleWindow = require('./NewVehicleWindow')

Constants = require('../dispatcher/Constants')
RouteStore = require('../stores/RouteStore')
VehicleStore = require('../stores/VehicleStore')
VehicleTypeStore = require('../stores/VehicleTypeStore')

getStateFromStores = ->
  partialsByVehicleId: RouteStore.getByVehicleId
  vehicleData: VehicleStore.getAll()
  vehicleTypes: VehicleTypeStore.getAll()

ViewportOverlay = React.createClass
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
    if (@props.overlayData?)
      switch (@props.overlayData.mode)
        when Constants.OverlayModes.EDIT_VEHICLE
          return <EditVehicleWindow
            setOverlayData={@props.setOverlayData}
            routePartials={@state.partialsByVehicleId(@props.overlayData.vehicleId)}
            editingRoutePartialIdx={@props.overlayData.editingRoutePartialIdx}
            vehicleData={@state.vehicleData[@props.overlayData.vehicleId]}
            onClose={_.bind(@props.setOverlayData, null, undefined)} />
        when Constants.OverlayModes.NEW_VEHICLE
          return <NewVehicleWindow
            onClose={_.bind(@props.setOverlayData, null, undefined)}
            vehicleTypes={@state.vehicleTypes} />

    return <div></div>

  _onChange: ->
    @setState(getStateFromStores())

module.exports = ViewportOverlay
