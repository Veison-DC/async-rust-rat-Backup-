import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  IconUsers,
  IconSettings,
  IconShieldFilled,
  IconCopyright,
  IconHistory,
  IconWorld,
} from "@tabler/icons-react";

import { RATContext } from "./rat/RATContext";
import { startServerCmd, stopServerCmd } from "./rat/RATCommands";
import { useContext } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "./components/LanguageSelector";

const SidebarButton = ({ icon: Icon, label, to, active }: any) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => navigate(to)}
        className={`flex flex-col items-center  rounded-xl text-white cursor-pointer transition
        ${active ? "bg-[--hover-sidebar-btn]" : "hover:bg-[#1f1f1f]"}
      `}
      >
        <div
          className={`p-2 rounded-xl ${
            active ? "bg-white text-black" : "text-white"
          }`}
        >
          <Icon size={20} />
        </div>
      </button>
      <span className="text-xs">{label}</span>
    </div>
  );
};

const SidebarBurger = ({ color, icon: Icon }: any) => {
  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <button className="p-2 rounded-xl hover:text-white">
        <Icon size={28} color={color} />
      </button>
    </div>
  );
};

export const Layout = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const { port, setPort, setRunning, running, clientList, setClientList } =
    useContext(RATContext)!;

  async function startServer() {
    let serverMessage = await startServerCmd(port);

    if (serverMessage === "true") {
      toast.success(t('layout.serverStarted'), {
        className: `!bg-white !text-black !rounded-2xl !border-accentx`,
      });

      setRunning(true);
    } else {
      toast.error(t('layout.serverFailed'), {
        className: `!bg-white !text-black !rounded-2xl !border-accentx`,
      });
    }
  }

  async function stopServer() {
    let serverMessage = await stopServerCmd();

    if (serverMessage === "true") {
      setClientList([]);
      toast.success(t('layout.serverStopped'), {
        className: `!bg-white !text-black !rounded-2xl !border-accentx`,
      });

      setRunning(false);
    } else {
      toast.error(t('layout.serverStopFailed'), {
        className: `!bg-white !text-black !rounded-2xl !border-accentx`,
      });
    }
  }

  return (
    <div className="flex h-screen w-screen bg-primarybg text-white flex-row justify-center">
      <aside className="w-20 bg-primarybg flex flex-col items-center py-3.5 gap-4 pl-2">
        <SidebarBurger
          color={running ? "#009000" : "#D22B2B"}
          icon={IconShieldFilled}
        />
        <SidebarButton
          icon={IconUsers}
          label={t('layout.clients')}
          to="/"
          active={location.pathname === "/"}
        />
        <SidebarButton
          icon={IconWorld}
          label={t('layout.worldMap')}
          to="/worldmap"
          active={location.pathname === "/worldmap"}
        />
        <SidebarButton
          icon={IconHistory}
          label={t('layout.logs')}
          to="/logs"
          active={location.pathname === "/logs"}
        />
        <SidebarButton
          icon={IconSettings}
          label={t('layout.settings')}
          to="/settings"
          active={location.pathname === "/settings"}
        />

        <div className="flex flex-col mt-auto text-xs text-accenttext text-center gap-4">
          <p>{running ? t('layout.listening', { port }) : t('layout.notListening')}</p>
          <p>{t('layout.educationalPurpose')}</p>
          <div className="flex flex-row justify-center items-center gap-1">
            <IconCopyright size={16} /> 2025
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1">
        <header className="h-14 bg-primarybg px-4 flex items-center pt-2 gap-3">
          <div className="flex items-center rounded-full bg-secondarybg pl-3 border border-accentx h-9">
            <div className="shrink-0 text-base text-accentx select-none sm:text-sm/6">
              {t('layout.port')}:
            </div>
            <input
              type="text"
              name="username"
              id="username"
              disabled={running}
              className={`block w-16 py-0 pl-2 text-base placeholder:text-gray-400 bg-transparent focus:outline-none sm:text-sm/6 ${
                running ? "text-accentx" : "text-white"
              }`}
              placeholder="1337"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>

          <button
            onClick={() => {
              if (running) {
                stopServer();
              } else {
                startServer();
              }
            }}
            className="cursor-pointer rounded-full px-4 py-1.5 border border-accentx bg-secondarybg text-white hover:bg-white hover:text-black transition"
          >
            {running ? t('layout.stop') : t('layout.start')}
          </button>

          <div className="ml-auto flex items-center gap-2 rounded-full bg-secondarybg px-4 py-1.5 border border-accentx text-white">
            <IconUsers size={18} className="text-white" />
            <span className="text-white">{t('layout.connected')}:</span>
            <span className="font-semibold text-white">
              {clientList.length}
            </span>
          </div>

          <LanguageSelector />
        </header>

        <main className="flex-1 overflow-auto m-3 text-black rounded-2xl">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  );
};
