import React, {FC, useCallback, useEffect, useRef, useState} from "react"
import {useTranslation} from "react-i18next"
import cn from "classnames"
import uuid from "uuid/v4"
import noop from "lodash/fp/noop"

import {Layout, LeafLayout, LeafLayoutData, HNodeLayout, VNodeLayout, emptyLeaf} from "./model"
import {ReactComponent as IconTrash} from "./icon-trash.svg"

import classes from "./layout.module.scss"

type Position = "top" | "right" | "bottom" | "left"

type Msg =
  | {
      type: "should-split"
      pos: Position
      layoutId: string
      callback: (shouldSplit: boolean) => void
    }
  | {
      type: "split"
      pos: Position
      layoutId: string
    }
  | {
      type: "propage-split"
      layoutId: string
      layout: Layout
    }
  | {
      type: "resize-start"
      layoutId: string
    }
  | {
      type: "resize-stop"
    }
  | {
      type: "update-layout"
      layout: Layout
    }
  | {
      type: "delete-view"
      layoutId: string
    }
  | {
      type: "delete-layout"
      prevLayoutId: string
      layout: Layout
    }

type ViewProps<L = Layout> = {
  parentRef: React.RefObject<HTMLDivElement>
  layout: L
  resizedLayoutId: string | null
  sendMsg: (msg: Msg) => void
  readOnly: boolean
}

const View: FC<ViewProps> = props => {
  const {layout} = props
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div ref={ref} className={classes.viewContainer}>
      {(() => {
        switch (layout.type) {
          case "leaf": {
            return <NoSplitView {...props} layout={layout} />
          }

          case "v-node": {
            return <VSplitView {...props} parentRef={ref} layout={layout} />
          }

          case "h-node": {
            return <HSplitView {...props} parentRef={ref} layout={layout} />
          }

          default:
            return null
        }
      })()}
    </div>
  )
}

const NoSplitView: FC<ViewProps<LeafLayout>> = props => {
  const {layout, sendMsg, readOnly} = props
  const [draggedOver, setDraggedOver] = useState(false)
  const [lock, setLock] = useState(true)
  const {t} = useTranslation()

  function grab(pos: Position) {
    return () => {
      sendMsg({
        type: "should-split",
        pos,
        layoutId: layout.id,
        callback: shouldSplit => {
          if (shouldSplit) {
            sendMsg({type: "split", pos, layoutId: layout.id})
          }
        },
      })
    }
  }

  function deleteView() {
    sendMsg({type: "delete-view", layoutId: layout.id})
  }

  function drop(evt: React.DragEvent<HTMLImageElement>) {
    evt.preventDefault()
    setLock(true)
    setDraggedOver(false)
    const type = evt.dataTransfer.getData("type") as LeafLayoutData["type"]
    const url = evt.dataTransfer.getData("url")
    sendMsg({type: "update-layout", layout: {...layout, data: {type, url}}})
  }

  function dragOver(evt: React.DragEvent<HTMLImageElement>) {
    evt.preventDefault()
    setDraggedOver(true)
  }

  function dragLeave(evt: React.DragEvent<HTMLImageElement>) {
    evt.preventDefault()
    setDraggedOver(false)
  }

  function startDragging(url: string) {
    return (evt: React.DragEvent<HTMLImageElement>) => {
      evt.dataTransfer.setData("type", "file")
      evt.dataTransfer.setData("url", url)
      setLock(false)
    }
  }

  function stopDragging() {
    if (!lock) sendMsg({type: "update-layout", layout: {...layout, data: null}})
    setLock(true)
  }

  return (
    <div
      className={cn(classes.view, {
        [classes.draggedOver]: draggedOver,
        [classes.readOnly]: readOnly,
      })}
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
      {(() => {
        if (!layout.data) return <div>{readOnly ? "" : t("no-content")}</div>
        switch (layout.data.type) {
          case "file":
            return (
              <img
                draggable={!readOnly}
                height="100%"
                src={layout.data.url}
                alt=""
                onDragStart={startDragging(layout.data.url)}
                onDragEnd={stopDragging}
              />
            )

          default:
            return <div>{readOnly ? "" : t("no-content")}</div>
        }
      })()}
      {!readOnly && (
        <>
          <button type="button" className={classes.handleTop} onMouseDown={grab("top")} />
          <button type="button" className={classes.handleRight} onMouseDown={grab("right")} />
          <button type="button" className={classes.handleBottom} onMouseDown={grab("bottom")} />
          <button type="button" className={classes.handleLeft} onMouseDown={grab("left")} />
          <button type="button" className={classes.deleteView} onMouseDown={deleteView}>
            <IconTrash />
          </button>
        </>
      )}
    </div>
  )
}

function withMinMax(val: number) {
  return Math.max(0, Math.min(100, val))
}

function withMagneticRulers(val: number) {
  return Math.abs(50 - val) < 2 ? 50 : val
}

const VSplitView: FC<ViewProps<VNodeLayout>> = props => {
  const {sendMsg: propageMsg, parentRef, layout, resizedLayoutId} = props
  const [val, setVal] = useState(0)

  const handleMsg = useCallback(
    (msg: Msg) => {
      switch (msg.type) {
        case "should-split": {
          switch (msg.pos) {
            case "left": {
              if (layout.right.id === msg.layoutId) {
                msg.callback(false)
                propageMsg({type: "resize-start", layoutId: layout.id})
              } else {
                propageMsg({
                  type: "should-split",
                  pos: msg.pos,
                  layoutId: layout.id,
                  callback: msg.callback,
                })
              }
              break
            }

            case "right": {
              if (layout.left.id === msg.layoutId) {
                msg.callback(false)
                propageMsg({type: "resize-start", layoutId: layout.id})
              } else {
                propageMsg({
                  type: "should-split",
                  pos: msg.pos,
                  layoutId: layout.id,
                  callback: msg.callback,
                })
              }
              break
            }

            default:
              msg.callback(true)
              break
          }
          break
        }

        case "split": {
          switch (msg.pos) {
            case "top": {
              const id = uuid()
              const pos = layout.left.id === msg.layoutId ? "left" : "right"
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  [pos]: {
                    id,
                    type: "h-node",
                    val: 0,
                    top: emptyLeaf(),
                    bottom: layout[pos],
                  },
                },
              })
              break
            }

            case "right": {
              const id = uuid()
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  right: {
                    id,
                    type: "v-node",
                    val: 100,
                    left: layout.right,
                    right: emptyLeaf(),
                  },
                },
              })
              break
            }

            case "bottom": {
              const id = uuid()
              const pos = layout.left.id === msg.layoutId ? "left" : "right"
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  [pos]: {
                    id,
                    type: "h-node",
                    val: 100,
                    top: layout[pos],
                    bottom: emptyLeaf(),
                  },
                },
              })
              break
            }

            case "left": {
              const id = uuid()
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  left: {
                    id,
                    type: "v-node",
                    val: 0,
                    left: emptyLeaf(),
                    right: layout.left,
                  },
                },
              })
              break
            }

            default:
              break
          }
          break
        }

        case "propage-split":
          propageMsg({
            ...msg,
            layout: {
              ...layout,
              [layout.left.id === msg.layout.id ? "left" : "right"]: msg.layout,
            },
          })
          break

        case "resize-start":
          propageMsg(msg)
          break

        case "resize-stop":
          if (resizedLayoutId === layout.id) {
            propageMsg({type: "update-layout", layout: {...layout, val}})
          }
          break

        case "update-layout":
          propageMsg({
            type: "update-layout",
            layout: {
              ...layout,
              [layout.left.id === msg.layout.id ? "left" : "right"]: msg.layout,
            },
          })
          break

        case "delete-view":
          propageMsg({
            type: "delete-layout",
            prevLayoutId: layout.id,
            layout: layout.left.id === msg.layoutId ? layout.right : layout.left,
          })
          break

        case "delete-layout":
          propageMsg({
            type: "update-layout",
            layout: {
              ...layout,
              [layout.left.id === msg.prevLayoutId ? "left" : "right"]: msg.layout,
            },
          })
          break

        default:
          break
      }
    },
    [layout, propageMsg, resizedLayoutId, val],
  )

  const resize = useCallback(
    (evt: MouseEvent) => {
      if (resizedLayoutId === layout.id && parentRef.current) {
        const bounds = parentRef.current.getBoundingClientRect()
        const {x: parentLeft, width: parentWidth} = bounds
        const deltaX = ((evt.clientX - parentLeft) * 100) / parentWidth
        setVal(withMinMax(withMagneticRulers(deltaX)))
      }
    },
    [layout.id, parentRef, resizedLayoutId],
  )

  const stopResizing = useCallback(() => {
    if (val === 0) {
      handleMsg({type: "delete-view", layoutId: layout.left.id})
    } else if (val === 100) {
      handleMsg({type: "delete-view", layoutId: layout.right.id})
    } else if (resizedLayoutId === layout.id) {
      propageMsg({type: "update-layout", layout: {...layout, val}})
    }
  }, [handleMsg, layout, propageMsg, resizedLayoutId, val])

  useEffect(() => {
    document.addEventListener("mouseup", stopResizing)
    document.addEventListener("mousemove", resize)

    return () => {
      document.removeEventListener("mouseup", stopResizing)
      document.removeEventListener("mousemove", resize)
    }
  }, [handleMsg, resize, stopResizing])

  useEffect(() => {
    setVal(layout.val)
  }, [layout])

  const active = {[classes.active]: resizedLayoutId === layout.id}
  const readOnly = {[classes.readOnly]: props.readOnly}

  return (
    <>
      <div className={cn(classes.leftView, active, readOnly)} style={{right: `${100 - val}%`}}>
        <View {...props} layout={layout.left} sendMsg={handleMsg} />
      </div>
      <div className={cn(classes.rightView, active, readOnly)} style={{left: `${val}%`}}>
        <View {...props} layout={layout.right} sendMsg={handleMsg} />
      </div>
      <div className={classes.vMagneticRuler} />
    </>
  )
}

const HSplitView: FC<ViewProps<HNodeLayout>> = props => {
  const {parentRef, sendMsg: propageMsg, layout, resizedLayoutId} = props
  const [val, setVal] = useState(0)

  const handleMsg = useCallback(
    (msg: Msg) => {
      switch (msg.type) {
        case "should-split": {
          switch (msg.pos) {
            case "top": {
              if (layout.bottom.id === msg.layoutId) {
                msg.callback(false)
                propageMsg({type: "resize-start", layoutId: layout.id})
              } else {
                propageMsg({
                  type: "should-split",
                  pos: msg.pos,
                  layoutId: layout.id,
                  callback: msg.callback,
                })
              }
              break
            }

            case "bottom": {
              if (layout.top.id === msg.layoutId) {
                msg.callback(false)
                propageMsg({type: "resize-start", layoutId: layout.id})
              } else {
                propageMsg({
                  type: "should-split",
                  pos: msg.pos,
                  layoutId: layout.id,
                  callback: msg.callback,
                })
              }
              break
            }

            default:
              msg.callback(true)
              break
          }
          break
        }

        case "split": {
          switch (msg.pos) {
            case "top": {
              const id = uuid()
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  top: {
                    id,
                    type: "h-node",
                    val: 0,
                    top: emptyLeaf(),
                    bottom: layout.top,
                  },
                },
              })
              break
            }

            case "right": {
              const id = uuid()
              const pos = layout.top.id === msg.layoutId ? "top" : "bottom"
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  [pos]: {
                    id,
                    type: "v-node",
                    val: 100,
                    left: layout[pos],
                    right: emptyLeaf(),
                  },
                },
              })
              break
            }

            case "bottom": {
              const id = uuid()
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  bottom: {
                    id,
                    type: "h-node",
                    val: 100,
                    top: layout.bottom,
                    bottom: emptyLeaf(),
                  },
                },
              })
              break
            }

            case "left": {
              const id = uuid()
              const pos = layout.top.id === msg.layoutId ? "top" : "bottom"
              propageMsg({
                type: "propage-split",
                layoutId: id,
                layout: {
                  ...layout,
                  [pos]: {
                    id,
                    type: "v-node",
                    val: 0,
                    left: emptyLeaf(),
                    right: layout[pos],
                  },
                },
              })
              break
            }

            default:
              break
          }
          break
        }

        case "resize-start":
          propageMsg(msg)
          break

        case "resize-stop":
          if (resizedLayoutId === layout.id) {
            propageMsg({type: "update-layout", layout: {...layout, val}})
          }
          break

        case "propage-split":
          propageMsg({
            ...msg,
            layout: {
              ...layout,
              [layout.top.id === msg.layout.id ? "top" : "bottom"]: msg.layout,
            },
          })
          break

        case "update-layout":
          propageMsg({
            type: "update-layout",
            layout: {
              ...layout,
              [layout.top.id === msg.layout.id ? "top" : "bottom"]: msg.layout,
            },
          })
          break

        case "delete-view":
          propageMsg({
            type: "delete-layout",
            prevLayoutId: layout.id,
            layout: layout.top.id === msg.layoutId ? layout.bottom : layout.top,
          })
          break

        case "delete-layout":
          propageMsg({
            type: "update-layout",
            layout: {
              ...layout,
              [layout.top.id === msg.prevLayoutId ? "top" : "bottom"]: msg.layout,
            },
          })
          break

        default:
          break
      }
    },
    [layout, propageMsg, resizedLayoutId, val],
  )

  const resize = useCallback(
    (evt: MouseEvent) => {
      if (resizedLayoutId === layout.id && parentRef.current) {
        const bounds = parentRef.current.getBoundingClientRect()
        const {y: parentTop, height: parentHeight} = bounds
        const deltaY = ((evt.clientY - parentTop) * 100) / parentHeight
        setVal(withMinMax(withMagneticRulers(deltaY)))
      }
    },
    [layout.id, parentRef, resizedLayoutId],
  )

  const stopResizing = useCallback(() => {
    if (val === 0) {
      handleMsg({type: "delete-view", layoutId: layout.top.id})
    } else if (val === 100) {
      handleMsg({type: "delete-view", layoutId: layout.bottom.id})
    } else if (resizedLayoutId === layout.id) {
      propageMsg({type: "update-layout", layout: {...layout, val}})
    }
  }, [handleMsg, layout, propageMsg, resizedLayoutId, val])

  useEffect(() => {
    document.addEventListener("mouseup", stopResizing)
    document.addEventListener("mousemove", resize)

    return () => {
      document.removeEventListener("mouseup", stopResizing)
      document.removeEventListener("mousemove", resize)
    }
  }, [handleMsg, resize, stopResizing])

  useEffect(() => {
    setVal(layout.val)
  }, [layout])

  const active = {[classes.active]: resizedLayoutId === layout.id}
  const readOnly = {[classes.readOnly]: props.readOnly}

  return (
    <>
      <div className={cn(classes.topView, active, readOnly)} style={{bottom: `${100 - val}%`}}>
        <View {...props} layout={layout.top} sendMsg={handleMsg} />
      </div>
      <div className={cn(classes.bottomView, active, readOnly)} style={{top: `${val}%`}}>
        <View {...props} layout={layout.bottom} sendMsg={handleMsg} />
      </div>
      <div className={classes.hMagneticRuler} />
    </>
  )
}

type ScreenLayoutProps = {
  layout?: Layout
  onChange?: (layout: Layout) => void
  readOnly?: boolean
}

const ScreenLayout: FC<ScreenLayoutProps> = props => {
  const {layout, readOnly = false} = props
  const setLayout = props.onChange || noop
  const frameRef = useRef<HTMLDivElement>(null)
  const [resizedLayoutId, setResizedLayoutId] = useState<string | null>(null)

  function sendMsg(msg: Msg) {
    if (!layout) return null
    switch (msg.type) {
      case "should-split":
        msg.callback(true)
        break

      case "split": {
        switch (msg.pos) {
          case "top": {
            const id = uuid()
            setResizedLayoutId(id)
            setLayout({
              id,
              type: "h-node",
              val: 0,
              top: emptyLeaf(),
              bottom: layout,
            })
            break
          }

          case "right": {
            const id = uuid()
            setResizedLayoutId(id)
            setLayout({
              id,
              type: "v-node",
              val: 100,
              left: layout,
              right: emptyLeaf(),
            })
            break
          }

          case "bottom": {
            const id = uuid()
            setResizedLayoutId(id)
            setLayout({
              id,
              type: "h-node",
              val: 100,
              top: layout,
              bottom: emptyLeaf(),
            })
            break
          }

          case "left": {
            const id = uuid()
            setResizedLayoutId(id)
            setLayout({
              id,
              type: "v-node",
              val: 0,
              left: emptyLeaf(),
              right: layout,
            })
            break
          }

          default:
            break
        }
        break
      }

      case "propage-split": {
        setLayout({...layout, ...msg.layout})
        setResizedLayoutId(msg.layoutId)
        break
      }

      case "resize-start":
        setResizedLayoutId(msg.layoutId)
        break

      case "delete-layout":
      case "update-layout": {
        setLayout({...layout, ...msg.layout})
        setResizedLayoutId(null)
        break
      }

      default:
        break
    }
  }

  return (
    <div className={cn(classes.container, {[classes.readOnly]: readOnly})}>
      <div ref={frameRef} className={classes.content}>
        {layout && (
          <View
            parentRef={frameRef}
            resizedLayoutId={resizedLayoutId}
            layout={layout}
            sendMsg={sendMsg}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  )
}

export default ScreenLayout
