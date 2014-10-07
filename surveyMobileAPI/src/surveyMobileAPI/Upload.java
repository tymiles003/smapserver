/*****************************************************************************

This file is part of SMAP.

SMAP is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

SMAP is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with SMAP.  If not, see <http://www.gnu.org/licenses/>.

 ******************************************************************************/

package surveyMobileAPI;

import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.Consumes;
import javax.ws.rs.HEAD;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import javax.ws.rs.core.Response.ResponseBuilder;
import javax.ws.rs.core.Response.Status;

import org.smap.sdal.Utilities.AuthorisationException;
import org.smap.sdal.Utilities.Authorise;
import org.smap.sdal.Utilities.NotFoundException;
import org.smap.sdal.Utilities.SDDataSource;
import org.smap.server.entities.MissingTemplateException;

import exceptions.SurveyBlockedException;


/*
 * Accept submitted surveys
 */
@Path("/submission")
public class Upload extends Application {
	
	Authorise a = new Authorise(Authorise.ENUM);
	
	private static Logger log =
			 Logger.getLogger(Upload.class.getName());
	
	// Tell class loader about the root classes.  (needed as tomcat6 does not support servlet 3)
	public Set<Class<?>> getClasses() {
		Set<Class<?>> s = new HashSet<Class<?>>();
		s.add(Upload.class);
		return s;
	}
	
	private static final String OPEN_ROSA_VERSION_HEADER = "X-OpenRosa-Version";
	private static final String OPEN_ROSA_VERSION = "1.0";
	private static final String DATE_HEADER = "Date";
	
	private static final String RESPONSE_MSG1 = 
		"<OpenRosaResponse xmlns=\"http://openrosa.org/http/response\">";
	private static final String RESPONSE_MSG2 = 
		"</OpenRosaResponse>";
	
	@Context UriInfo uriInfo;
	
	/*
	 * New Submission
	 */
	@POST
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	public Response postInstance(
			@Context HttpServletRequest request) throws IOException {
		
		System.out.println("New submssion");
		return submission(request, null);
	}
	
	/*
	 * Update
	 */
	@POST
	@Path("/{instanceId}")
	@Consumes(MediaType.MULTIPART_FORM_DATA)
	public Response postUpdateInstance(
			@Context HttpServletRequest request,
	        @PathParam("instanceId") String instanceId) throws IOException {
		
		System.out.println("Update submssion: " + instanceId);
		return submission(request, instanceId);
	}
	
	private Response submission(HttpServletRequest request,  String instanceId) 
			throws IOException {
	
		Response response = null;
		
		// Authorisation - Access
		try {
		    Class.forName("org.postgresql.Driver");	 
		} catch (ClassNotFoundException e) {
			log.log(Level.SEVERE, "Can't find PostgreSQL JDBC Driver", e);
			response = Response.serverError().entity("Survey: Error: Can't find PostgreSQL JDBC Driver").build();
		}

		Connection connectionSD = SDDataSource.getConnection("surveyMobileAPI-Upload");
		a.isAuthorised(connectionSD, request.getRemoteUser());
		
		try {
			if (connectionSD != null) {
				connectionSD.close();
			}
		} catch (SQLException e) {
			log.log(Level.SEVERE, "Failed to close connection", e);
		}
		// End Authorisation

		// Extract the data
		try {
			log.info("Info: Upload Started =================");
			log.info("Url:" + request.getRequestURI());
			XFormData xForm = new XFormData();
			xForm.loadMultiPartMime(request, request.getRemoteUser(), instanceId);
			log.info("User:" + request.getRemoteUser());
			log.info("Server:" + request.getServerName());
			log.info("Info: Upload finished =================");
			
			response = Response.created(uriInfo.getBaseUri()).status(HttpServletResponse.SC_CREATED)
					.entity(RESPONSE_MSG1 + 	"<message>Upload Success</message>" + RESPONSE_MSG2)
					.type("text/xml")
					.header(OPEN_ROSA_VERSION_HEADER, OPEN_ROSA_VERSION).build();
					
		} catch (SurveyBlockedException e) {
			log.info(e.getMessage());
			response = Response.status(Status.FORBIDDEN).entity(e.getMessage()).build();
		} catch (AuthorisationException e) {
			log.info(e.getMessage());
			response = Response.status(Status.UNAUTHORIZED).entity(e.getMessage()).build();
		} catch (NotFoundException e) {
			log.info(e.getMessage());
			response = Response.status(Status.NOT_FOUND).entity(e.getMessage()).build();
		} catch (MissingTemplateException e) {
			log.log(Level.SEVERE, "", e);
			response = Response.status(Status.NOT_FOUND).entity(e.getMessage()).build();
		} catch (Exception e) {
			log.log(Level.SEVERE, "", e);
			response = Response.status(Status.BAD_REQUEST).entity(e.getMessage()).build();
		}

		return response;
	}
	
	/*
	 * Head request to return the actual URL to submit data to
	 * This is required by the Java Rosa protocol
	 */
		@HEAD
		@Produces(MediaType.TEXT_XML)
		public void getHead(@Context HttpServletRequest request,  @Context HttpServletResponse resp) {
		
			String url = request.getScheme() + "://" + request.getServerName() + "/submission";
			
			log.info("URL:" + url); 
			resp.setHeader("location", url);
			resp.setHeader(OPEN_ROSA_VERSION_HEADER,  OPEN_ROSA_VERSION);
			resp.setStatus(HttpServletResponse.SC_OK);
			
		}
}
