# @cjsx React.DOM

React = require('react')

PIXI = require('pixi.js/bin/pixi.js')
_ = require('lodash')

collision = require('generic_modules/collision')
math = require('generic_modules/math')
util = require('generic_modules/utility')
astar = require('generic_modules/astar')

build = require('game_modules/build')
config = require('game_modules/config')
mapgen = require('game_modules/mapgen')

Constants = require('../dispatcher/Constants')
MapActions = require('../actions/MapActions')
MapStore = require('../stores/MapStore')

pixiRenderer = undefined

# create an new instance of a pixi stage with a grey background
stage = new PIXI.Stage(0x3D7228)
heatmaps = new PIXI.DisplayObjectContainer()
debugDrawables = new PIXI.DisplayObjectContainer()
debugSegments = new PIXI.DisplayObjectContainer()
debugMapData = new PIXI.DisplayObjectContainer()
zoomContainer = new PIXI.DisplayObjectContainer()
drawables = new PIXI.DisplayObjectContainer()

# for roads and buildings
dynamicDrawables = new PIXI.DisplayObjectContainer()

stage.addChild(heatmaps)

debugDrawables.addChild(debugSegments)
debugDrawables.addChild(debugMapData)

drawables.addChild(dynamicDrawables)
zoomContainer.addChild(drawables)
stage.addChild(zoomContainer)

routePartialSelectionMode = true
firstSelection = true
pathSelectionStart = undefined

segments = []
qTree = undefined
heatmap = undefined

debugSegmentI = undefined
initialised = false
dt = 0
time = null
touchDown = false
diffX = 0
diffY = 0
cumulDiff =
  x: 0
  y: 0
prevX = null
prevY = null
zoom = 0.01 * window.devicePixelRatio
debugDrawablesAdded = false
populationHeatMap = undefined
debugLinksGraphics = undefined
pathGraphics = undefined
pickupRangeIndicator = undefined
tempRouteGraphics = undefined
gameCanvas = undefined

camera =
  x: 0
  y: -500
  vx: 0
  vy: 0

stage.touchstart = stage.mousedown = (data) ->
  touchDown = true
  prevX = data.global.x
  prevY = data.global.y

stage.touchend = stage.touchendoutside =
stage.mouseup = stage.mouseupoutside  = (data) ->
  touchDown = false

  if (math.lengthV2(cumulDiff) <= config.gameLogic.SELECT_PAN_THRESHOLD)
    # not the exact location of the beginning of the click, good enough
    clickEvent(data.global.x, data.global.y)
  cumulDiff.x = 0
  cumulDiff.y = 0

# --- debug graphics start ---
graphics = new PIXI.Graphics()
graphics.lineStyle(4, PIXI.rgb2hex([0, 1, 0]))
graphics.moveTo(0, 50)
graphics.lineTo(0, 0)
graphics.lineStyle(4, PIXI.rgb2hex([1, 0, 1]))
graphics.moveTo(0, 0)
graphics.lineTo(50, 0)
debugDrawables.addChild(graphics)

# draw quad tree
drawQTree = (qTree) ->
  graphics = new PIXI.Graphics()
  graphics.beginFill(0x000000, 0)
  graphics.lineStyle(20, 0x880000, 0.2)
  graphics.drawRect(qTree.bounds.x, qTree.bounds.y, qTree.bounds.width, qTree.bounds.height)
  graphics.endFill()
  debugDrawables.addChild(graphics)
  for i in [0...qTree.nodes.length] by 1
    node = qTree.nodes[i]
    drawQTree(node)
# drawQTree(qTree)
# --- debug graphics end ---

closestSegment = (location) ->
  {x, y} = location
  matches = qTree.retrieve({
    x: x
    y: y
    width: 1
    height: 1
  })

  minVal = undefined
  closestMatch = undefined
  minDistance2 = undefined
  matchFraction = undefined
  _.each(matches, (match, i) ->
    # if it's a road segment
    if (match.o.r?)
      {distance2, lineProj2, length2} = math.distanceToLine({x: x, y: y}, match.o.r.start, match.o.r.end)
      val = (if (lineProj2 <= length2 && lineProj2 >= 0) then distance2 else Number.POSITIVE_INFINITY)
      if (!closestMatch? || val < minVal)
        minVal = val
        closestMatch = matches[i]
        minDistance2 = distance2
        matchFraction = Math.sqrt(lineProj2) / match.o.length()
  )

  return {
    closestMatch: closestMatch
    minDistance2: minDistance2
    matchFraction: matchFraction
  }

clickEvent = (clickX, clickY) ->
  worldClick =
    x: (clickX - zoomContainer.x) / zoom + camera.x
    y: (clickY - zoomContainer.y) / zoom + camera.y

  {closestMatch, minDistance2, matchFraction} = closestSegment(worldClick)

  # draw mouse click
  graphics = new PIXI.Graphics()
  drawables.addChild(graphics)
  graphics.beginFill(0xFFFFFF, 1)
  graphics.drawCircle(worldClick.x, worldClick.y, 4)
  graphics.endFill()

  if (closestMatch? && Math.sqrt(minDistance2) * zoom < config.gameLogic.SELECTION_RANGE)
    if (routePartialSelectionMode)
      if (firstSelection)
        pathSelectionStart = new astar.PathLocation(closestMatch.o, matchFraction)
        firstSelection = false
      else
        pathSelectionEnd = new astar.PathLocation(closestMatch.o, matchFraction)
        firstSelection = true

        path = astar.calc.find(pathSelectionStart, pathSelectionEnd)
        if (!pathGraphics?)
          pathGraphics = new PIXI.Graphics()
          drawables.addChild(pathGraphics)
        else if (pathGraphics.children.length > 0)
          pathGraphics.removeChildren()

        _.each(path, (pathSegment) ->
          pathGraphics.addChild(drawSegment(pathSegment, 0xFFFFFF, 25))
        )

    console.log("#{segments.indexOf(closestMatch.o).toString()} clicked")

    if (config.mapGeneration.DEBUG)
      if (debugLinksGraphics)
        debugDrawables.removeChild(debugLinksGraphics)

      debugLinksGraphics = new PIXI.DisplayObjectContainer()
      closestMatch.o.debugLinks()
      debugLinksGraphics.addChild(drawSegment(closestMatch.o))
      _.each(closestMatch.o.links.f, (link) ->
        debugLinksGraphics.addChild(drawSegment(link))
      )
      _.each(closestMatch.o.links.b, (link) ->
        debugLinksGraphics.addChild(drawSegment(link))
      )
      debugDrawables.addChild(debugLinksGraphics)

drawSegment = (segment, color, width) ->
  color = util.defaultFor(color, segment.q.color)
  width = util.defaultFor(width, segment.width)

  graphics = new PIXI.Graphics()
  graphics.beginFill(0x000000, 0)
  graphics.lineStyle(width, color)

  graphics.drawCircle(segment.r.start.x, segment.r.start.y, 2)
  graphics.moveTo(segment.r.start.x, segment.r.start.y)
  graphics.lineTo(segment.r.end.x, segment.r.end.y)
  graphics.drawCircle(segment.r.end.x, segment.r.end.y, 2)
  graphics.endFill()
  return graphics

animate = ->
  if (initialised)
    now = new Date().getTime()
    dt = now - (time || now)
    time = now

    zoom = (zoom + MapStore.getTargetZoom()) / 2.0;

    zoomContainer.scale.x = zoom
    zoomContainer.scale.y = zoom

    if (config.mapGeneration.DRAW_HEATMAP && heatmap?)
      if (!populationHeatMap?)
        populationHeatMap = new PIXI.Graphics()
        heatmaps.addChild(populationHeatMap)
      else
        populationHeatMap.clear()
      w = pixiRenderer.width
      h = pixiRenderer.height

      for x in [0...w] by config.mapGeneration.HEAT_MAP_PIXEL_DIM
        for y in [0...h] by config.mapGeneration.HEAT_MAP_PIXEL_DIM
          xSample = (x + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 - zoomContainer.x) / zoom + camera.x
          ySample = (y + config.mapGeneration.HEAT_MAP_PIXEL_DIM / 2 - zoomContainer.y) / zoom + camera.y
          value = heatmap.populationAt(xSample, ySample)
          populationHeatMap.beginFill(PIXI.rgb2hex([0, value, 0]))
          populationHeatMap.drawRect(x, y,
            config.mapGeneration.HEAT_MAP_PIXEL_DIM, config.mapGeneration.HEAT_MAP_PIXEL_DIM)
          populationHeatMap.endFill()
    else if (populationHeatMap?)
      heatmaps.removeChild(populationHeatMap)
      populationHeatMap = undefined

    if (config.mapGeneration.DEBUG && !debugDrawablesAdded && debugDrawables?)
      debugDrawablesAdded = true
      drawables.addChild(debugDrawables)
    else if (!config.mapGeneration.DEBUG && debugDrawablesAdded && debugDrawables?)
      debugDrawablesAdded = false
      drawables.removeChild(debugDrawables)

    if (config.mapGeneration.DEBUG && debugSegmentI < segments.length)
      toDraw = segments[debugSegmentI++]
      debugSegments.addChild(drawSegment(toDraw, 0x77AA77, 25))
    else if (!config.mapGeneration.DEBUG && debugSegmentI > 0)
      debugSegmentI = 0
      if (debugSegments.children.length > 0)
        debugSegments.removeChildren()

    touchX = stage.getMousePosition().x
    touchY = stage.getMousePosition().y

    if (routePartialSelectionMode)
      if (!pickupRangeIndicator?)
        pickupRangeIndicator = new PIXI.Graphics()
        pickupRangeIndicator.beginFill(0xFF0000, 0.3)
        pickupRangeIndicator.lineStyle(4, 0xFF0000)
        pickupRangeIndicator.drawCircle(0, 0, config.gameLogic.DEFAULT_PICKUP_RANGE)
        pickupRangeIndicator.endFill()
        drawables.addChild(pickupRangeIndicator)
      {closestMatch, minDistance2, matchFraction} = closestSegment({x: (touchX - zoomContainer.x) / zoom + camera.x, y: (touchY - zoomContainer.y) / zoom + camera.y})
      if (closestMatch? && minDistance2 <= config.gameLogic.DEFAULT_PICKUP_RANGE * config.gameLogic.DEFAULT_PICKUP_RANGE)
        matchPoint = math.fractionBetween(closestMatch.o.r.start, closestMatch.o.r.end, matchFraction)
        pickupRangeIndicator.x = matchPoint.x
        pickupRangeIndicator.y = matchPoint.y

    if (touchDown)
      # check if outside area
      if (touchX > 0 && touchY > 0)
        diffX = touchX - prevX
        diffY = touchY - prevY

        prevX = touchX
        prevY = touchY

      cumulDiff.x += diffX
      cumulDiff.y += diffY

      # invert for swiping motion
      camera.vx = -diffX / zoom
      camera.vy = -diffY / zoom

      camera.x += camera.vx
      camera.y += camera.vy

    if (!touchDown)
      camera.x += camera.vx
      camera.y += camera.vy
      # stickiness
      camera.vx *= 0.8
      camera.vy *= 0.8

    drawables.x = -camera.x
    drawables.y = -camera.y

    pixiRenderer.render(stage)

  requestAnimationFrame(animate)

GameCanvas = React.createClass
  getInitialState: ->
    return {}

  componentDidMount: ->
    MapStore.addChangeListener(@_onMapChange)

    seed = new Date().getTime()
    console.log("seed: #{seed.toString()}")

    MapActions.generate(seed)

    canvasContainer = @refs.canvasContainer.getDOMNode()
    canvasEl = @refs.canvas.getDOMNode()
    if (canvasEl?)
      canvasEl.style.width = "#{canvasContainer.offsetWidth}px"
      canvasEl.style.height = "#{canvasContainer.offsetHeight}px"
      rendererWidth = canvasContainer.offsetWidth * window.devicePixelRatio
      rendererHeight = canvasContainer.offsetHeight * window.devicePixelRatio

      pixiRenderer = PIXI.autoDetectRenderer(rendererWidth, rendererHeight, canvasEl, false, true)
      canvasContainer.appendChild(pixiRenderer.view)

      zoomContainer.x = pixiRenderer.width / 2
      zoomContainer.y = pixiRenderer.height / 2

      requestAnimationFrame(animate)

      window.addEventListener('resize', @_handleResize)

  componentWillUnmount: ->
    # TODO: remove listeners and cleanup?
    MapStore.removeChangeListener(@_onMapChange)
    window.removeEventListener('resize', @_handleResize)

  shouldComponentUpdate: (nextProps, nextState) ->
    return false # never update DOM, would destroy PIXI setup

  render: ->
    <div id="canvas-container" ref="canvasContainer"><canvas ref="canvas"></canvas></div>

  _handleResize: ->
    canvasContainer = @refs.canvasContainer.getDOMNode()
    canvasEl = @refs.canvas.getDOMNode()
    canvasEl.style.width = "#{canvasContainer.offsetWidth}px"
    canvasEl.style.height = "#{canvasContainer.offsetHeight}px"
    rendererWidth = canvasContainer.offsetWidth * window.devicePixelRatio
    rendererHeight = canvasContainer.offsetHeight * window.devicePixelRatio
    if (pixiRenderer?)
      pixiRenderer.resize(rendererWidth, rendererHeight)

      zoomContainer.x = pixiRenderer.width / 2
      zoomContainer.y = pixiRenderer.height / 2

  _onChange: ->
    @setState(getStateFromStores())

  _onMapChange: ->
    gameCanvas = @

    if (pathGraphics? && pathGraphics.children.length > 0)
      pathGraphics.removeChildren()

    if (dynamicDrawables.children.length > 0)
      dynamicDrawables.removeChildren()

    segments = MapStore.getSegments()
    qTree = MapStore.getQTree()
    heatmap = MapStore.getHeatmap()
    debugData = MapStore.getDebugData()

    if (debugMapData.children.length > 0)
      debugMapData.removeChildren()

    debugSegmentI = 0
    if (debugSegments.children.length > 0)
      debugSegments.removeChildren()

    _.each(debugData.snaps, (point) ->
      graphics = new PIXI.Graphics()
      graphics.beginFill(0x00FF00)
      graphics.moveTo(point.x, point.y)
      graphics.drawCircle(point.x, point.y, 20)
      graphics.endFill()
      debugMapData.addChild(graphics)
    )

    _.each(debugData.intersectionsRadius, (point) ->
      graphics = new PIXI.Graphics()
      graphics.beginFill(0x0000FF)
      graphics.moveTo(point.x, point.y)
      graphics.drawCircle(point.x, point.y, 20)
      graphics.endFill()
      debugMapData.addChild(graphics)
    )

    _.each(debugData.intersections, (point) ->
      graphics = new PIXI.Graphics()
      graphics.beginFill(0xFF0000)
      graphics.moveTo(point.x, point.y)
      graphics.drawCircle(point.x, point.y, 20)
      graphics.endFill()
      debugMapData.addChild(graphics)
    )

    buildings = []
    for i in [0...segments.length] by 10
      segment = segments[i]

      newBuildings = build.buildingFactory.aroundSegment(
        -> build.buildingFactory.fromProbability(new Date().getTime()),
        segment, 10, 400, qTree
      )
      for building in newBuildings
        qTree.insert(building.collider.limits())
      buildings = buildings.concat(newBuildings)

    for building in buildings
      buildingGraphics = new PIXI.Graphics()
      buildingGraphics.beginFill(0x0C161F)
      buildingGraphics.lineStyle(5, 0x555555)
      buildingGraphics.moveTo(building.corners[0].x, building.corners[0].y)
      buildingGraphics.lineTo(building.corners[1].x, building.corners[1].y)
      buildingGraphics.lineTo(building.corners[2].x, building.corners[2].y)
      buildingGraphics.lineTo(building.corners[3].x, building.corners[3].y)
      buildingGraphics.lineTo(building.corners[0].x, building.corners[0].y)
      dynamicDrawables.addChild(buildingGraphics)

    for i in [0...segments.length] by 1
      segment = segments[i]

      lineColor
      if (segment.q.color)
        lineColor = segment.q.color
      else
        lineColor = 0xA1AFA9

      dynamicDrawables.addChild(drawSegment(segment, lineColor))

    initialised = true

module.exports = GameCanvas
