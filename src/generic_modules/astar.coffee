# author: tmwhere.com

util = require('generic_modules/utility')
HashMap = require('map')

module.exports =
  PathLocation:
    class PathLocation
      constructor: (@o, @fraction) ->

  calc: do ->
    cost = (current, next, start, end) ->
      currentFraction = undefined
      nextFraction = undefined
      if (start.o == end.o)
        fraction = Math.abs(start.fraction - end.fraction)
        return fraction * current.cost()
      else
        if (current == start.o)
          currentFraction = start.fraction
        if (next == end.o)
          nextFraction = end.fraction
      return current.costTo(next, currentFraction) + next.costTo(current, nextFraction)

    {
      find: (start, end) ->
        frontier = new util.PriorityQueue
        frontier.put(start.o, 0)
        came_from = new HashMap
        came_from.put(start.o, null)
        cost_so_far = new HashMap
        cost_so_far.put(start.o, 0)

        while (frontier.length() > 0)
          current = frontier.get()

          if current == end.o
            break

          for next in current.neighbours()
            new_cost = cost_so_far.get(current) + cost(current, next, start, end)
            if !cost_so_far.get(next)? || new_cost < cost_so_far.get(next)
              cost_so_far.put(next, new_cost)
              priority = new_cost # + heuristic(goal, next)
              frontier.put(next, priority)
              came_from.put(next, current)

        console.log("path cost: #{cost_so_far.get(end.o)}")
        # reconstruct path
        current = end.o
        path = [current]
        while current != start.o
          current = came_from.get(current)
          path.unshift(current)

        return path
    }
