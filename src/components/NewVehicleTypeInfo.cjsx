# @cjsx React.DOM

React = require('react')

PlayerStore = require('../stores/PlayerStore')
VehicleActions = require('../actions/VehicleActions')


NewVehicleTypeInfo = React.createClass
  render: ->
    vehicleData = @props.vehicleTypes[@props.id]

    <div>
      Type: {vehicleData.type}<br/>
      Capacity: {vehicleData.capacity}<br/>
      Speed: {vehicleData.speed}<br/>
      Price: {vehicleData.price}<br/>
      <button onClick={_.bind(@_onOkButton, null)}>Ok</button>
    </div>

  _onOkButton: ->
    VehicleActions.create(@props.id, PlayerStore.getCurrentId())


module.exports = NewVehicleTypeInfo