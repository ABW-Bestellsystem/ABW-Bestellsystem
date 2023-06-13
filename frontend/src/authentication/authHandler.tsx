import axios, { AxiosError } from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Card, Container, Offcanvas } from 'react-bootstrap';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';
import infoPopup from '../modules/infoPopup';
import Menu from '../modules/menu/Menu';
import { loggedInUserSchema, ResponseData, Site } from '../../schemas/Schemas';
export interface AuthContextType {
  accessToken: string;
  refreshToken: string;
  isOrdered: string[];
  user?: loggedInUserSchema;
  sites: Array<Site | undefined>;
  loggedIn: boolean | undefined;
  updateUserOrder: () => void;
  register: (credentials: Register) => void;
  signin: (credentials: SignIn, redirect: VoidFunction) => void;
  signout: (redirect: VoidFunction) => void;
  forceSignout: (redirect: VoidFunction) => void;
  getSites: () => void;
}

interface Register {
  forename: string;
  surname: string;
  password: string;
  passwordConfirm: string;
  rank: string;
}

interface SignIn {
  username: string;
  password: string;
}

let AuthContext = createContext<AuthContextType>(null!);

export function useAuth(): AuthContextType {
  let context = useContext(AuthContext);

  if (!context) {
    return {
      accessToken: '',
      refreshToken: '',
      isOrdered: [],
      sites: [],
      loggedIn: false,
      forceSignout(redirect: any) { },
      register(credentials: any) { },
      signin(credentials: any, redirect: any) { },
      signout(redirect: any) { },
      updateUserOrder() { },
      getSites() { },
      user: {
        _id: '',
        forename: '',
        new: false,
        order: [],
        permissionID: 'User',
        rank: '',
        surname: '',
        username: '',
        runnercount: 0
      },
    };
  }

  return context;
}

export function Auth({ children }: { children: JSX.Element }) {
  let auth = useAuth();

  const location = useLocation();

  //TODO: check if accessToken is expired
  if (!localStorage.getItem('accessToken')) {
    return <Navigate to={'/'} replace />;
  }

  if (auth.sites.length === 0 && auth.user?.permissionID === 'Editor') {
    if(!location.pathname.startsWith('/edit'))
      return <Navigate to={'/editor'} replace />;
    else
      return children;
  }

  if (auth.sites.length === 0) {
    return (
      <>
        <Menu />
        <Container className="content">
          <Card>
            <h3 className="text-center">
              Aktuell sind keine Bestellseiten verfügbar
            </h3>
          </Card>
        </Container>
      </>
    );
  }

  return children;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<string>('');
  const [user, setUser] = useState<loggedInUserSchema>({
    _id: '',
    forename: '',
    new: false,
    order: [],
    permissionID: 'User',
    rank: '',
    surname: '',
    username: '',
    runnercount: 0
  });

  const [loggedIn, setloginStatus] = useState<boolean>();
  const [sites, setSites] = useState<Site[]>([]);
  const [isOrdered, setIsOrdered] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setAccessToken(localStorage.getItem('accessToken') || '');
    setRefreshToken(localStorage.getItem('refreshToken') || '');

    setloginStatus(localStorage.getItem('accessToken') ? true : undefined);
  }, []);

  useEffect(() => {
    if (accessToken.length > 0) {
      getSites();
      getUser();
      getIsOrdered();
    }
  }, [accessToken]);

  const getIsOrdered = async () => {
    await axios
      .get(`${config.url}/users/isOrdered`, {
        headers: {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      })
      .then((res: ResponseData) => {
        setIsOrdered(res.data.res);
      })
      .catch((err: AxiosError) => {
        console.log(err);
        forceSignout(() => navigate('/'));
      });
  }

  const updateUserOrderCount = async () => {
    await axios
      .get(`${config.url}/users/orders`, {
        headers: {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      })
      .then((res: ResponseData) => {
        // ?
        //TODO: Rausfiltern von nicht sichtbaren Seiten
        setUser({
          ...user,
          order: res.data.res,
        });
      })
      .catch((err: AxiosError) => {
        console.log(err);
        forceSignout(() => navigate('/'));
      });
  };

  const getSites = async () => {
    axios
      .get(`${config.url}/customPage/sites`, {
        headers: {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      })
      .then((res: ResponseData) => {
        setSites(res.data.res);
      })
      .catch((err: AxiosError) => {
        console.log(err);
        forceSignout(() => navigate('/'));
      });
  };

  const getUser = async () => {
    axios
      .get(`${config.url}/users/data`, {
        headers: {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      })
      .then((res: ResponseData) => {
        setUser(res.data.res);
      })
      .catch((err: AxiosError) => {
        console.log(err);
        forceSignout(() => navigate('/'));
      });
  };

  const register = async (credentials: Register) => {
    axios
      .post(`${config.url}/auth/register`, credentials)
      .then((res: ResponseData) => {
        infoPopup.success(
          'Du kannst dich nun einloggen',
          'Registrierung erfolgreich'
        );
      })
      .catch((err: AxiosError) => {
        console.log(err);

        infoPopup.error(
          'Du musst alle Felder ausfüllen! Des Weiteren kann dein Passwort schwach sein oder es hat nicht die erforderliche Länge von min. 5 Zeichen',
          'Registrierung fehlgeschlagen'
        );
      });
  };

  const signin = async (credentials: SignIn, redirect: VoidFunction) => {
    await axios
      .post(`${config.url}/auth/login`, credentials)
      .then((res: ResponseData) => {
        infoPopup.success(
          'Login erfolgreich',
          'Du kannst jetzt deine Bestellung tätigen!'
        );

        setloginStatus(true);

        localStorage.setItem('accessToken', res.data.res.accessToken);
        localStorage.setItem('refreshToken', res.data.res.refreshToken);
        setAccessToken(res.data.res.accessToken);
        setRefreshToken(res.data.res.refreshToken);
      })
      .catch((err: AxiosError) => {
        const responseData = (err.response as ResponseData).data;

        if (responseData.error !== 419)
          infoPopup.error(responseData.res, 'Fehler!');
      });

    redirect();
  };

  const signout = async (redirect: VoidFunction) => {
    if (accessToken && refreshToken)
      await axios
        .delete(`${config.url}/auth/logout`, {
          headers: {
            accessToken: accessToken,
            refreshToken: refreshToken,
          },
        })
        .then((res: ResponseData) => {
          infoPopup.info(res.data.res);
          return redirect();
        })
        .catch((err: AxiosError) => {
          const responseData = (err.response as ResponseData).data;

          if (responseData.error !== 419)
            infoPopup.error(responseData.res, 'Fehler!');
        });

    setAccessToken('');
    setRefreshToken('');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    setloginStatus(undefined);
  };

  const forceSignout = async (redirect: VoidFunction) => {
    setAccessToken('');
    setRefreshToken('');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    setloginStatus(false);

    return redirect();
  };

  return (
    <AuthContext.Provider
      value={{
        loggedIn,
        getSites,
        isOrdered,
        user,
        updateUserOrder: updateUserOrderCount,
        accessToken,
        refreshToken,
        sites,
        register,
        signin,
        signout,
        forceSignout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
