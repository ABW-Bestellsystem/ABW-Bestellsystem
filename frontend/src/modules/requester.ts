import axios, { AxiosError } from 'axios';
import { AuthContextType, useAuth } from '../authentication/authHandler';
import config from '../config';
import infoPopup from './infoPopup';

interface ResponseAxiosSchema {
  access: boolean;
  res: any;
}

interface ResponseData {
  data: {
    access: boolean;
    error?: any;
    res: any;
  };
}

interface RequestHandlerReturnTypes {
  get: (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  erase: (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  put: (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface AdminResponses {
  get: (
    body: Object,
    dest: 'runner' | 'access' | 'pdf' | 'pdfdata' | 'usersettings',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: 'pdfdata' | 'mailorder',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  put: (
    body: Object,
    dest: 'pwreset' | 'acceptuser',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface AuthResponses {
  post: (
    body: Object,
    dest: 'register' | 'login' | 'token',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  erase: (
    body: Object,
    dest: 'logout',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface CustomPageResponses {
  post: (
    body: Object,
    dest: 'sites' | 'settings',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  get: (
    body: Object,
    dest: 'sites' | 'settings' | 'menuAddions',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  erase: (
    body: Object,
    dest: 'userorders' | 'runners' | 'site',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface EditorResponses {
  get: (
    body: Object,
    dest: 'notifications',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: 'notification',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  erase: (
    body: Object,
    dest: 'user' | 'notification',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  put: (
    body: Object,
    dest: 'keys' | 'promoteranks' | 'refreshtokens' | 'promoteadmin',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface MenuResponses {
  get: (body: Object, dest: '', then?: (data: ResponseAxiosSchema) => void) => Promise<void>;
  put: (
    body: Object,
    dest: 'item',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: 'ingredient',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  erase: (
    body: Object,
    dest: 'item' | 'ingredient',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

interface UserResponses {
  get: (
    body: Object,
    dest: '' | 'data' | 'runner' | 'runnerinfo' | 'orders',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: 'runner' | 'orderlist',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  put: (
    body: Object,
    dest: 'deleteorder' | 'pwreset',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}
interface StatisticResponses {
  get: (
    body: Object,
    dest: 'pricecount' | 'ordercount',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
  post: (
    body: Object,
    dest: 'save',
    then?: (data: ResponseAxiosSchema) => void
  ) => Promise<void>;
}

async function Requester(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  dest: string,
  body: Object,
  auth: AuthContextType,
  siteID?: string,
  navigate?: VoidFunction
): Promise<ResponseAxiosSchema | undefined> {
  const { data, error }: { data: ResponseAxiosSchema; error: any | undefined } =
    await axios({
      method: method,
      url: `${config.url}/${path}/${dest}`,
      headers: {
        accessToken: auth.accessToken,
        siteID: siteID ?? '',
      },
      params: method === "GET" ? body : undefined,
      data: body,
    })
      .then((res: ResponseData) => {
        return { data: res.data, error: res.data.error };
      })
      .catch((err) => {
        const responseData = (err.response as ResponseData).data;

        if (responseData.error !== 419) {
          infoPopup.error(responseData.res, 'Fehler!');
        }

        if (!responseData.access && navigate) auth.forceSignout(navigate);

        return { data: responseData, error: responseData.error };
      });

  if (error) return;

  return {
    access: data.access,
    res: data.res,
  };
}

/**
 * RequestHandler
 *
 * @param auth authentication for API-Requests
 * @param siteID siteID for API-Requests
 * @param navigate destination for errors
 * @returns get, post
 */
function RequestHandler(
  path: string,
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
): RequestHandlerReturnTypes {
  /**
   * GET
   * @param dest Destination for request
   * @param then returns data from API
   */
  const get = async (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => {
    const data = await Requester("GET", path, dest, body, auth, siteID, navigate);

    if (then && data) then(data);
    return;
  };

  /**
   * POST
   * @param dest Destination for request
   * @param then returns data from API
   */
  const post = async (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => {
    const data = await Requester(
      "POST",
      path,
      dest,
      body,
      auth,
      siteID,
      navigate
    );

    if (then && data) then(data);
    return;
  };

  /**
   * PUT
   * @param dest Destination for request
   * @param then returns data from API
   */
  const put = async (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => {
    const data = await Requester(
      "PUT",
      path,
      dest,
      body,
      auth,
      siteID,
      navigate
    );

    if (then && data) then(data);
    return;
  };

  /**
   * ERASE (DELETE)
   * @param dest Destination for request
   * @param then returns data from API
   */
  const erase = async (
    body: Object,
    dest: string,
    then?: (data: ResponseAxiosSchema) => void
  ) => {
    const data = await Requester(
      "DELETE",
      path,
      dest,
      body,
      auth,
      siteID,
      navigate
    );

    if (then && data) then(data);
    return;
  };

  return { get, post, put, erase };
}

/**
 * RequestHandler for Admins
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @returns get, post
 */
function AdminRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler('manage', auth, navigate, siteID) as AdminResponses;
}

/**
 * RequestHandler for AuthRoute
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @param siteID siteID for API-Requests
 * @returns get, post
 */
function AuthRequest(auth: AuthContextType, navigate?: VoidFunction) {
  return RequestHandler('auth', auth, navigate) as AuthResponses;
}

/**
 * RequestHandler for EditorRoute
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @returns get, post
 */
function CustomPageRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler(
    'customPage',
    auth,
    navigate,
    siteID
  ) as CustomPageResponses;
}

/**
 * RequestHandler for EditorRoute
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @returns get, post
 */
function EditorRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler('editor', auth, navigate, siteID) as EditorResponses;
}

/**
 * RequestHandler for Users
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @param siteID siteID for API-Requests
 * @returns get, post, put
 */
function UserRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler('users', auth, navigate, siteID) as UserResponses;
}

/**
 * RequestHandler for MenuRoute
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @param siteID siteID for API-Requests
 * @returns get, post
 */
function MenuRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler('menu', auth, navigate, siteID) as MenuResponses;
}

/**
 * RequestHandler for MenuRoute
 *
 * @param auth authentication for API-Requests
 * @param navigate destination for errors
 * @param siteID siteID for API-Requests
 * @returns get, post
 */
function StatisticRequest(
  auth: AuthContextType,
  navigate?: VoidFunction,
  siteID?: string
) {
  return RequestHandler('statistic', auth, navigate, siteID) as StatisticResponses;
}

export {
  AdminRequest,
  UserRequest,
  MenuRequest,
  AuthRequest,
  EditorRequest,
  CustomPageRequest,
  StatisticRequest
};
