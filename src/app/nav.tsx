import React, {FC} from "react"
import {useLocation} from "react-router-dom"
import {useTranslation} from "react-i18next"
import classNames from "classnames"

import useScreens from "../screen/context"
import Link from "./link"

import classes from "./nav.module.scss"

type NavProps = {
  isVisible: boolean
  close: () => void
}

const Nav: FC<NavProps> = props => {
  const dataVisible = props.isVisible ? {"data-visible": ""} : {}
  const {pathname} = useLocation()
  const {screens} = useScreens()
  const {t} = useTranslation()

  function handleBurgerClick(evt: React.MouseEvent) {
    evt.preventDefault()
    props.close()
  }

  return (
    <nav className={classes.nav} {...dataVisible}>
      <Link className={classes.logo} to="/">
        <img src="/images/logo.svg" alt="" />
        <button className={classes.burger} type="button" onClick={handleBurgerClick}>
          <img src="/images/icon-close.svg" alt="" />
        </button>
      </Link>

      <Link
        className={classNames(classes.item, {[classes.active]: pathname.startsWith("/screens")})}
        to="/screens"
      >
        <img className={classes.itemIcon} src="/images/icon-screen.svg" alt="" />
        <span className={classes.itemText}>{t("screens")}</span>
        <span className={classes.itemCount}>{screens.length}</span>
      </Link>

      <Link
        className={classNames(classes.item, {[classes.active]: pathname.startsWith("/playlists")})}
        to="/playlists"
      >
        <img className={classes.itemIcon} src="/images/icon-playlist.svg" alt="" />
        <span className={classes.itemText}>{t("playlists")}</span>
      </Link>

      <Link className={classes.subitem} to="/playlists/1">
        <span className={classes.itemText}>
          <span className={classes.itemPill} />
          Playlist exemple
        </span>
      </Link>

      <Link
        className={classNames(classes.item, {[classes.active]: pathname.startsWith("/plannings")})}
        to="/plannings"
      >
        <img className={classes.itemIcon} src="/images/icon-planning.svg" alt="" />
        <span className={classes.itemText}>{t("plannings")}</span>
      </Link>

      <Link className={classes.subitem} to="/plannings/1">
        <span className={classes.itemText}>
          <span className={classes.itemPill} />
          Planning exemple
        </span>
      </Link>
    </nav>
  )
}

export default Nav
