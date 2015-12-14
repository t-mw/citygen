# @cjsx React.DOM

_ = require('lodash')
React = require('react')

HoverWindow = require('./HoverWindow')
ListView = require('./ListView')
NewVehicleListItem = require('./NewVehicleListItem')
NewVehicleTypeInfo = require('./NewVehicleTypeInfo')

NewVehicleWindow = React.createClass
  getInitialState: ->
    selectedVehicleId: undefined

  render: ->
    selectedVehicleId = if @state.selectedVehicleId? then @state.selectedVehicleId else _.keys(@props.vehicleTypes)[0]

    <HoverWindow onClose={@props.onClose} contents={
      <span>
        <div className="column">
          <ListView items={_.map(@props.vehicleTypes, (vehicleData) ->
            <NewVehicleListItem onClick={_.bind(@_onVehicleClick, @, vehicleData.id)} vehicleData={vehicleData} />
          , @)} />
        </div>
        <div className="column">
          <NewVehicleTypeInfo vehicleTypes={@props.vehicleTypes} id={selectedVehicleId} />
        </div>
      </span>
      } />

  _onVehicleClick: (id) ->
    @setState(selectedVehicleId: id)

module.exports = NewVehicleWindow