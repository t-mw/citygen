_ = require('lodash')

module.exports =
  defaultFor: (arg, val, deep) ->
    argCopy = if deep then _.cloneDeep(arg) else arg
    valCopy = if deep then _.cloneDeep(val) else val
    if typeof arg != 'undefined' then argCopy else valCopy

  joinArrayGeneric: (array, joinElement) ->
    copy = array.slice(0)
    for i in [1...copy.length * 2 - 1] by 2
      copy.splice(i, 0, joinElement)
    return copy
    

  addArrayPushListener: (array, callback) ->
    array.push = ->
      for i in [0..arguments.length-1] by 1
          this[@length] = arguments[i]
          callback()
      return this.length

  minDegreeDifference: (d1, d2) ->
    diff = Math.abs(d1 - d2) % 180
    return Math.min(diff, Math.abs(diff-180))

  extendedMin: (collection, selector) ->
    if (!selector?)
      selector = (obj) -> obj

    minObj = undefined
    minObj_i = 0
    _.each(collection, (obj, i) ->
      if (!minObj? || selector(obj) < selector(minObj)) 
        minObj = obj
        minObj_i = i
    )
    return [minObj, minObj_i]

  extendedMax: (collection, selector) ->
    if (!selector?)
      selector = (obj) -> obj

    maxObj = undefined
    maxObj_i = 0
    _.each(collection, (obj, i) ->
      if (!maxObj? || selector(obj) > selector(maxObj)) 
        maxObj = obj
        maxObj_i = i
    )
    return [maxObj, maxObj_i]

  PriorityQueue:
    class PriorityQueue
      constructor: ->
        @list = []

      put: (item, priority) ->
        newPair =
          item: item
          priority: priority

        index = _.findIndex(@list, (pair) ->
          pair.priority > newPair.priority
        )
        if (index == - 1)
          @list.push(newPair)
        else
          @list.splice(index, 0, newPair)
        
      get: ->
        @list.shift().item

      length: ->
        @list.length