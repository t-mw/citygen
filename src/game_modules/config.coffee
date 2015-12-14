# author: tmwhere.com

math = require('generic_modules/math')

branchAngleDev = 3
forwardAngleDev = 15
randomAngle = (limit) ->
  # non-linear distribution
  nonUniformNorm = Math.pow(Math.abs(limit), 3)
  val = 0
  while (val == 0 || Math.random() < Math.pow(Math.abs(val), 3)/nonUniformNorm)
    val = math.randomRange(-limit, +limit)
  return val

configVariables = {
  mapGeneration:
    BUILDING_PLACEMENT_LOOP_LIMIT: 3 # by the nth iteration of building placement no further collisions are allowed
    DEFAULT_SEGMENT_LENGTH: 300
    HIGHWAY_SEGMENT_LENGTH: 400
    DEFAULT_SEGMENT_WIDTH: 6
    HIGHWAY_SEGMENT_WIDTH: 16
    RANDOM_BRANCH_ANGLE: ->
      randomAngle(branchAngleDev)
    RANDOM_STRAIGHT_ANGLE: ->
      randomAngle(forwardAngleDev)
    DEFAULT_BRANCH_PROBABILITY: 0.4
    HIGHWAY_BRANCH_PROBABILITY: 0.05
    HIGHWAY_BRANCH_POPULATION_THRESHOLD: 0.1
    NORMAL_BRANCH_POPULATION_THRESHOLD: 0.1
    NORMAL_BRANCH_TIME_DELAY_FROM_HIGHWAY: 5
    MINIMUM_INTERSECTION_DEVIATION: 30 # degrees
    SEGMENT_COUNT_LIMIT: 2000
    DEBUG_DELAY: 0 # ms
    ROAD_SNAP_DISTANCE: 50
    HEAT_MAP_PIXEL_DIM: 50 # px
    DRAW_HEATMAP: false
    QUADTREE_PARAMS:
      x: -20000
      y: -20000
      width: 40000
      height: 40000
    QUADTREE_MAX_OBJECTS: 10
    QUADTREE_MAX_LEVELS: 10
    DEBUG: false
  gameLogic:
    SELECT_PAN_THRESHOLD: 50 # px, limit beyond which a click becomes a drag
    SELECTION_RANGE: 50 # px
    DEFAULT_PICKUP_RANGE: 150 # world units, range for vehicles to pick up things
    DEFAULT_BOOST_FACTOR: 2
    DEFAULT_BOOST_DURATION: 2 # minutes
    MIN_LENGTH_FOR_VEHICLE_ARRIVAL: 0.1
    DEFAULT_CARGO_CAPACITY: 1
    MIN_SPEED_PROPORTION: 0.1 # the minimum reduction of the speed of a road when congested
}

module.exports = do ->
  return configVariables
