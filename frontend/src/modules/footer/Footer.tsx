import { useEffect, useState } from 'react';
import { Button, Col, Offcanvas, Row, Toast } from 'react-bootstrap';
import { BellFill } from 'react-bootstrap-icons';
import { Link } from 'react-router-dom';
import { INotifySchema } from '../../../schemas/Schemas';
import { useAuth } from '../../authentication/authHandler';
import InfoPopUp from '../infoPopup';
import { EditorRequest } from '../requester';
import { ArrayEquals, formatToLittleDate } from '../Tools';
import './footerstyle.css';

const Footer = (props: any) => {
  const [notify, toggleNotify] = useState(false);
  const [notifications, setNotifications] = useState<INotifySchema[]>([]);

  const [acceptedNotifications, setAcceptedNotifications] = useState<string[]>(
    []
  );

  const auth = useAuth();

  useEffect(() => {
    if (auth.loggedIn) {
      getNotify();
      getAcceptedNotifications();
    }
  }, []);

  useEffect(() => {
    //check if variables are empty
    if (!notifications && !acceptedNotifications) return;

    acceptedNotifications.forEach((notification) => {
      //If the DB notifications doesnt include the accepted notification, remove it
      if (!notifications.find((notifyItem) => notifyItem._id === notification.split("-")[1]))
        localStorage.removeItem(notification);
    });

    if (
      !ArrayEquals(
        acceptedNotifications,
        notifications.flatMap((notification) => `notify-${notification._id}`)
      ) &&
      notifications.length > 0
    )
      toggleNotify(true);
  }, [notifications]);

  const getNotify = () => {
    EditorRequest(auth).get({filter: true}, 'notifications', (data) => {
      setNotifications(data.res);
    });
  };

  const getAcceptedNotifications = () => {
    const ntf = Object.keys(localStorage).filter((sessionItem) =>
      sessionItem.startsWith('notify')
    );

    setAcceptedNotifications(ntf);
  };

  const markNotifyAsRead = (notifyID: string) => {
    localStorage.setItem(`notify-${notifyID}`, '1');
    InfoPopUp.info('Benachrichtung als gelesen makiert!', 'Gelesen!');
    setAcceptedNotifications([...acceptedNotifications, `notify-${notifyID}`]);
  };

  const markAllNotifyAsUnread = () => {
    acceptedNotifications.map((sessionitem: string) => {
      localStorage.removeItem(sessionitem);
    });
    setAcceptedNotifications([]);
  };

  const markAllNotifyAsRead = () => {
    const acceptAll: string[] = [];

    notifications.forEach((notification) => {
      localStorage.setItem(`notify-${notification._id}`, '1');
      acceptAll.push(`notify-${notification._id}`);
    });

    InfoPopUp.info('Benachrichtung als gelesen makiert!', 'Gelesen!');
    setAcceptedNotifications(acceptAll);
    toggleNotify(false);
  };

  return (
    <footer className="credits">
      <Offcanvas
        className="notify"
        scroll
        show={notify}
        onHide={() => toggleNotify(false)}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Benachrichtigungen</Offcanvas.Title>
        </Offcanvas.Header>
        <div className="notify-acceptbuttons">
          <Row>
            <Col>
              <Button onClick={() => markAllNotifyAsRead()}>
                Als gelesen makieren
              </Button>
            </Col>
            <Col>
              <Button onClick={() => markAllNotifyAsUnread()}>
                Als ungelesen makieren
              </Button>
            </Col>
          </Row>
        </div>
        <Offcanvas.Body>
          <div>
            {notifications.map((notification) => {
              return (
                <div key={notification._id}>
                  <Toast onClose={() => markNotifyAsRead(notification._id)}>
                    <Toast.Header
                      closeButton={
                        !acceptedNotifications.includes(
                          `notify-${notification._id}`
                        )
                      }
                    >
                      <strong className="me-auto">{notification.title}</strong>
                      <small>{formatToLittleDate(notification.start)}</small>-
                      <small>{formatToLittleDate(notification.end)}</small>
                    </Toast.Header>
                    <Toast.Body>{notification.text}</Toast.Body>
                  </Toast>
                  <hr />
                </div>
              );
            })}
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      <div className="info">
        This App is developed by{' '}
        <a href="https://github.com/riko2909">Riko</a> | {'  '}
        <Link to={'/privacyinfo'}>Datenschutzinfo</Link>
      </div>
      <div
        onClick={() => toggleNotify(!notify)}
        className={`notify-button ${acceptedNotifications.length !== notifications.length
            ? 'notify-ring'
            : null
          }`}
      >
        <BellFill className="icon" size={18} />
      </div>
    </footer>
  );
};

export default Footer;
