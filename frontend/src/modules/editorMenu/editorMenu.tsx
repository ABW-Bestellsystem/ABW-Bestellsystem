import { useState } from 'react';
import {
  Button,
  Dropdown
} from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { useAuth } from '../../authentication/authHandler';
import { AddSite } from './SitePopUp/sitePopUp';

function Menu() {
  const [show, setShow] = useState(false);

  const auth = useAuth();

  return (
    <>
      <AddSite show={show} onHide={() => setShow(false)} />
      <Link style={{ color: 'white' }} to="/editor/statistics">
        <Button className='me-3' style={{ width: "150px" }} variant='primary'>
          Statistiken
        </Button>
      </Link>
      <Link style={{ color: 'white' }} to="/editor/backup">
        <Button className='me-3' style={{ width: "150px" }} variant='primary'>
          Backup
        </Button>
      </Link>
      <Dropdown className='d-inline-block'>
        <Dropdown.Toggle variant="success" id="dropdown-basic">
          Bestellseiten ({auth.sites.length})
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {auth.sites.map((site: any) => (
            <Dropdown.Item
              as={Link}
              key={site._id}
              to={`/edit/${site._id}`}
            >
              {site.sitename}
            </Dropdown.Item>
          ))}
          <Dropdown.Item disabled key="placeholder">
            -----------------
          </Dropdown.Item>
          <Dropdown.Item key="createSite" onClick={() => setShow(true)}>
            Seite erstellen
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

    </>
  );
}

export default Menu;
